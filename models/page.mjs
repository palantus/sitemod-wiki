import Entity, { duplicate, sanitize, query } from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs"
import Showdown from "showdown"
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";
import Share from "../../../models/share.mjs";
import User from "../../../models/user.mjs";

class Page extends Entity {

  initNew(id, user) {
    id = Page.createId(id)
    if (Page.lookup(id))
      throw "Wiki page already exists"

    this.id = id;
    this.created = getTimestamp()
    this.rel(user, "author")
    this.tag("wiki")

    ACL.setDefaultACLOnEntity(this, user, DataType.lookup("wiki"))
  }

  static createPrivateIndex(id, user) {
    let page = Page.lookup(id)
    if (!page) {
      page = new Page(id, user)
      page.rel(user, "owner")
      page.body = `Hi ${user.name},\n\nWelcome to your private wiki page!`
      page.convertBody()
      page.title = `${user.name} - Private wiki`
      page.acl = "r:private;w:private"
    }
    return page
  }

  static lookup(id, revisionId) {
    if (!id) return null;
    return revisionId ? query.type(Page).id(revisionId).tag("wiki").tag("revision").prop("id", id).first
      : query.type(Page).prop("id", id).tag("wiki").not(query.tag("revision")).first
  }

  static createId(id) {
    return id.replace(/^\s+|\s+$/g, '') // trim
      .toLowerCase()
      .replace(/\//g, '-') //Replace / with -
      .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
      .replace(/\s+/g, '-') // collapse whitespace and replace by -
      .replace(/-+/g, '-'); // collapse dashes
  }

  static isOfType(entity) {
    if (!entity) return false;
    return entity.tags?.includes("wiki") || false;
  }

  convertBody() {
    if (!this.body) return this.html = ""
    let bodyConverted = this.body.replace(/\[\[([a-zA-Z0-9\-]+)\]\]/g, (grp, pageId) => `[${Page.lookup(pageId)?.title || Page.idToTitle(pageId)}](/wiki/${pageId})`)
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
        let image = this.rels.image?.find(i => i.hash == id) || null
        return `${global.sitecore.apiURL}/wiki/image/${id}?shareKey=${image?.shareKey || ""}`
      });
  }

  static idToTitle(id) {
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/\-/g, " ")
  }

  hasAccess(user, right = 'r', shareKey) {
    return new ACL(this.getPageForAccessValidation(), DataType.lookup("wiki")).hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true) {
    return new ACL(this.getPageForAccessValidation(), DataType.lookup("wiki")).validateAccess(res, right, respondIfFalse)
  }

  static validateAccessImage(res, hash, respondIfFalse = true) {
    let idSet = new Set()
    for (let page of Page.search(`tag:wiki image.prop:"hash=${hash}"`).map(p => p.getPageForAccessValidation())) {
      if (idSet.has(page._id)) continue;
      idSet.add(page._id)
      if (page.validateAccess(res, 'r', respondIfFalse))
        return true;
    }
    return false;
  }

  rights(user) {
    if (user.permissions.includes("admin")) return 'rw'
    let acl = new ACL(this.getPageForAccessValidation(), DataType.lookup("wiki"))
    return "" + (acl.hasAccess(user, "r") ? 'r' : '') + (acl.hasAccess(user, "w") ? 'w' : '')
  }

  getPageForAccessValidation() {
    return this.isRevision ? Page.from(this.relsrev.revision?.[0]) : this;
  }

  get isRevision() {
    return this.tags.includes("revision")
  }

  delete() {
    this.rels.image?.forEach(i => {
      this.removeRel(i, "image")
      if (!i.relsrev.image) {
        i.delete();
      }
    })
    this.rels.revision?.forEach(e => Page.from(e).delete())
    this.rels.share?.forEach(s => Share.from(s).delete())
    super.delete();
  }

  storeRevision(author) {
    if (this.body === undefined || this.isRevision) return;
    let revision = duplicate(this).tag("revision")
    this.rel(revision, "revision")
    this.rel(author, "author", true)
    for (let [rev, e] of Object.entries(revision.rels.revision || {}))
      revision.removeRel(e, rev); // Don't keep revisions of revisions
  }

  static all() {
    return query.type(Page).tag("wiki").not(query.tag("revision")).all
  }

  get userTags() {
    return this.tags.filter(t => t.startsWith("user-")).map(t => t.substring(5))
  }

  get revisions() {
    return this.rels.revision?.map(r => Page.from(r)) || []
  }

  get author() {
    return User.from(this.related.author)
  }

  toObj(user) {
    let title = this.title || (this.id == "index" ? "Wiki Index" : Page.idToTitle(this.id))
    if (this.body && !this.html)
      this.convertBody()

    let isRevision = this.isRevision
    let author = this.related.author
    return {
      id: this.id,
      revisionId: isRevision ? this._id : null,
      title,
      body: this.body,
      html: this.html || "",
      exists: true,
      tags: this.userTags,
      rights: this.rights(user),
      modified: this.modified,
      revisions: isRevision ? [] : (this.rels.revision?.map(r => {
        let author = r.related.author
        return {
          id: r._id,
          modified: r.modified,
          author: author ? { id: author.id, name: author.name } : null
        }
      })) || [],
      author: author ? { id: author.id, name: author.name } : null
    }
  }

  static nullObj(id, res) {
    if (res?.locals.user && res?.locals.user.id != "guest" && id == `index-private-${res?.locals.user.id}`)
      return Page.createPrivateIndex(id, res.locals.user).toObj(res.locals.user)
    return { id, title: (id == "index" ? "Wiki Index" : Page.idToTitle(id)), body: "", html: "", exists: false, tags: [], rights: "rw", revisions: [], revisionId: null }
  }
}

export default Page
