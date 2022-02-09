import Entity, {sanitize} from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs"
import { service as userService } from "../../../services/user.mjs"
import User from "../../../models/user.mjs"
import Showdown from "showdown"

class Page extends Entity {
  
  initNew(id){
    this.id = Page.createId(id);

    this.created = getTimestamp()
    this.tag("wiki")
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

  static convertBody(md) {
    if (!md) return ""
    let bodyConverted = md.replace(/\[\[([a-zA-Z0-9\-]+)\]\]/g, (grp, pageId) => `[${Page.lookupUnsafe(pageId)?.title || Page.idToTitle(pageId)}](/wiki/${pageId})`)
      .replace(/\[\[(\/[a-zA-Z0-9\-\/\?\&\=]+)\]\]/g, (grp, link) => `[${link.substr(link.lastIndexOf("/") + 1)}](${link})`)
    let converter = new Showdown.Converter({
      tables: true,
      simplifiedAutoLink: true,
      simpleLineBreaks: true,
      requireSpaceBeforeHeadingText: true
    })
    return converter.makeHtml(bodyConverted);
  }

  static idToTitle(id){
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/\-/g, " ")
  }

  hasAccess(user){
    switch(this.access){
      case "public":
        return true;
      case "role":
        return !this.related.role || !!user?.roles.includes(this.related.role.id)
      case "private":
        return user && user._id == this.related.owner?._id
      case "shared": 
      default:
        return !!user
    }
  }

  validateAccess(res){
    if(!this.hasAccess(res.locals.user)){
      res.status(403).json({ error: `You do not have access to page ${this.id}` })
      return false;
    }
    return true;
  }

  toObj(user){
    let title = this.title || (this.id == "index" ? "Wiki Index" : Page.idToTitle(this.id))
    if (this.body && !this.html)
      this.html = Page.convertBody(this.body)

    let html = (this.html || "").replace(/(\/img\/([\da-zA-Z]+))/g, (src, uu, id) => `${global.sitecore.apiURL}/wiki/image/${id}${user ? `?token=${userService.getTempAuthToken(user)}` : ''}`) //Replace image urls

    return{ 
      id: this.id, 
      title, 
      body: this.body, 
      html, 
      exists: true, 
      tags: this.tags.filter(t => t.startsWith("user-")).map(t => t.substring(5)),
      access: this.access || "shared",
      role: this.related.role?.id || null
    }
  }

  static nullObj(id){
    return { id, title: (id == "index" ? "Wiki Index" : Page.idToTitle(id)), body: "", html: "", exists: false, tags: [] }
  }
}

export default Page