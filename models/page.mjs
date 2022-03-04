import Entity, {sanitize} from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs"
import Showdown from "showdown"
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";

class Page extends Entity {
  
  initNew(id, user){
    id = Page.createId(id)
    if(Page.lookup(id))
      throw "Wiki page already exists"

    this.id = id;
    this.created = getTimestamp()
    this.tag("wiki")

    ACL.setDefaultACLOnEntity(this, user, DataType.lookup("wiki"))
  }

  static createPrivateIndex(id, user){
    let page = Page.lookup(id)
    if(!page){
      page = new Page(id, user)
      page.rel(user, "owner")
      page.body = `Hi ${user.name},\n\nWelcome to your private wiki page!`
      page.convertBody()
      page.title = `${user.name} - Private wiki`
      page.acl = "r:private;w:private"
    }
    return page
  }

  static lookup(id) {
    if(!id) return null;
    return Page.find(`tag:wiki prop:"id=${id}"`)
  }
  static lookupUnsafe(id) {
    if(!id) return null;
    return Page.lookup(sanitize(Page.createId(id)))
  }


  static createId(id){
    return id.replace(/^\s+|\s+$/g, '') // trim
             .toLowerCase()
             .replace(/\//g, '-') //Replace / with -
             .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
             .replace(/\s+/g, '-') // collapse whitespace and replace by -
             .replace(/-+/g, '-'); // collapse dashes
  }

  convertBody() {
    if (!this.body) return this.html = ""
    let bodyConverted = this.body.replace(/\[\[([a-zA-Z0-9\-]+)\]\]/g, (grp, pageId) => `[${Page.lookupUnsafe(pageId)?.title || Page.idToTitle(pageId)}](/wiki/${pageId})`)
      .replace(/\[\[(\/[a-zA-Z0-9\-\/\?\&\=]+)\]\]/g, (grp, link) => `[${link.substr(link.lastIndexOf("/") + 1)}](${link})`)
    let converter = new Showdown.Converter({
      tables: true,
      simplifiedAutoLink: true,
      simpleLineBreaks: true,
      requireSpaceBeforeHeadingText: true
    })
    this.html = converter.makeHtml(bodyConverted)
                         .replace(/(\/img\/([\da-zA-Z]+))/g, (src, uu, id) => {
                            //Replace image urls
                            let image = Entity.find(`tag:wiki-image prop:"hash=${id}" image..id:${this}`)
                            return `${global.sitecore.apiURL}/wiki/image/${id}?shareKey=${image?.shareKey || ""}`
                          });
  }

  static idToTitle(id){
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/\-/g, " ")
  }

  hasAccess(user, right = 'r', shareKey){
    return new ACL(this, DataType.lookup("wiki")).hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true){
    return new ACL(this, DataType.lookup("wiki")).validateAccess(res, right, respondIfFalse)
  }

  static validateAccessImage(res, hash, respondIfFalse = true){
    for(let page of Page.search(`tag:wiki image.prop:"hash=${hash}"`)){
      if(page.validateAccess(res, 'r', respondIfFalse))
        return true;
    }
    return false;
  }

  rights(user){
    let acl = new ACL(this, DataType.lookup("wiki"))
    return "" + (acl.hasAccess(user, "r")?'r':'') + (acl.hasAccess(user, "w")?'w':'')
  }

  delete(){
    this.rels.image?.forEach(i => {
      this.removeRel(i, "image")
      if(!i.relsrev.image){
        i.delete();
      }
    })
    super.delete();
  }

  static all(){
    return Page.search("tag:wiki")
  }

  get userTags(){
    return this.tags.filter(t => t.startsWith("user-")).map(t => t.substring(5))
  }

  toObj(user){
    let title = this.title || (this.id == "index" ? "Wiki Index" : Page.idToTitle(this.id))
    if (this.body && !this.html)
      this.convertBody()

    return{ 
      id: this.id, 
      title, 
      body: this.body, 
      html : this.html || "", 
      exists: true, 
      tags: this.userTags,
      rights: this.rights(user)
    }
  }

  static nullObj(id, res){
    if(res?.locals.user && res?.locals.user.id != "guest" && id == `index-private-${res?.locals.user.id}`)
      return Page.createPrivateIndex(id, res.locals.user).toObj()
    return { id, title: (id == "index" ? "Wiki Index" : Page.idToTitle(id)), body: "", html: "", exists: false, tags: [], rights: "rw" }
  }
}

export default Page