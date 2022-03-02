import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity, {sanitize, nextNum} from "entitystorage";
import { validateAccess } from "../../../../services/auth.mjs"
import { getTimestamp } from "../../../../tools/date.mjs"
import Page from "../../models/page.mjs"
import Setup from "../../models/setup.mjs";
import Role from "../../../../models/role.mjs";
import MySetup from "../../models/setup-mine.mjs";

export default (app) => {

  const route = Router();
  app.use("/wiki", route)

  route.post("/generate-id", (req, res, next) => {
    res.json(Page.createId(req.body.id))
  })

  route.post("/new-private-document", (req, res, next) => {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = `doc-${nextNum("wiki-doc")}`
    let page = new Page(id, res.locals.user)
    page.tag("user-doc")
    page.acl = "r:private;w:private"
    res.json(page.toObj())
  })

  route.get("/exists", (req, res, next) => {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let id = Page.createId(req.query.id)
    let wiki = Page.lookup(id)
    res.json(wiki ? true : false)
  })
  route.get('/search', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    if (!req.query.filter || typeof req.query.filter !== "string") return []
    let filter = req.query.filter.replace(/[^a-zA-ZæøåÆØÅ0-9 -:]/g, '') //Remove invalid chars
    let pages;
    if(filter.startsWith("tag:")){
      pages = Page.search(`tag:wiki tag:"user-${filter.substring(4)}"`)
    } else {
      pages = Page.search(`tag:wiki (${filter.split(" ").map(w => `(prop:"body~${w}"|prop:"title~${w}"|tag:"user-${w}")`).join(" ")})`)
    }
    pages = pages.filter(p => p.validateAccess(res, 'r', false))
    res.json(pages.map(p => ({ id: p.id, title: p.title, private: !!p.acl?.startsWith("r:private") })))
  });

  route.get('/setup/mine', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    res.json(MySetup.lookup(res.locals.user).toObj());
  });

  route.patch('/setup/mine', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let setup = MySetup.lookup(res.locals.user)
    res.json(true);
  });

  route.get('/setup', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.setup" })) return;
    res.json(Setup.lookup().toObj());
  });

  route.patch('/setup', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.setup" })) return;
    let setup = Setup.lookup();
    res.json(true);
  });

  route.get('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id)
    if(wiki && !wiki.validateAccess(res, 'r')) return;
    res.json(wiki ? wiki.toObj(res.locals.user) : Page.nullObj(id, res))
  });

  route.delete('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id)
    if(wiki && !wiki.validateAccess(res, 'w')) return;
    if (wiki) wiki.delete();
    res.json(true);
  });

  route.patch('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id) || new Page(id, res.locals.user)
    if(!wiki.validateAccess(res, 'w')) return;

    if (req.body.body !== undefined) {
      wiki.body = req.body.body
      wiki.html = Page.convertBody(req.body.body)

      // Update file references:
      let files = [...wiki.html.matchAll(/(\/img\/([\da-zA-Z]+))/g)].map(i => i[2]).map(id => Entity.find(`tag:wiki-image prop:"hash=${id}"`)).filter(f => f != null)
      let ids = files.map(f => f._id)
      for (let r of wiki.rels.image || []) {
        if (!ids.includes(r._id)) {
          wiki.removeRel(r, "image")
          if (!wiki.related.image)
            r.delete() //Not used by any wiki page anymore
        }
      }
      for (let f of files) {
        wiki.rel(f, "image")
      }
    };
    if (req.body.title !== undefined) wiki.title = req.body.title;

    if (wiki.body && !wiki.title) {
      wiki.title = id == "index" ? "Wiki Index" : Page.idToTitle(id)
    }
    if (req.body.tags !== undefined) {
      let tags = typeof req.body.tags === "string" ? req.body.tags.split(",").map(t => "user-" + t.trim())
        : Array.isArray(req.body.tags)
          ? req.body.tags.map(t => "user-" + t.trim())
          : wiki.tags
      tags.push(...wiki.tags.filter(t => !t.startsWith("user-"))) // Include default tags
      wiki.tag(tags, true);
    }
    wiki.prop("modified", getTimestamp())

    if(!wiki.related.owner){
      wiki.rel(res.locals.user, "owner")
    }

    res.json({ id: wiki.id, title: wiki.title || wiki.id, body: wiki.body, html: wiki.html || "" });
  });

  route.post("/:id/attach-image", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;

    let f = null;
    if (req.files) {
      if (Object.keys(req.files).length < 1) throw "No file sent"

      let filedef = Object.keys(req.files)[0]
      let fileObj = Array.isArray(req.files[filedef]) ? req.files[filedef] : [req.files[filedef]]
      if (fileObj.length < 1) throw "No files provided"
      f = fileObj[0]
    } else if (req.query.hash) {
      f = { name: req.query.name || "file", size: parseInt(req.header("Content-Length")), md5: req.query.hash, mimetype: req.query.mime || "application/x-binary", data: req }
    }
    if (!f) throw "No files"

    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id) || new Page(id, res.locals.user)
    if(!wiki.validateAccess(res, 'w')) return;

    let file = Entity.find(`tag:wiki-image prop:"hash=${f.md5}"`)

    if (!file) {
      file = new Entity().tag("wiki-image")
        .prop("name", f.name)
        .prop("size", f.size)
        .prop("hash", f.md5)
        .prop("mime", f.mimetype)
        .prop("timestamp", getTimestamp())
        .setBlob(f.data)
    }

    wiki.rel(file, "image")
    res.json({ hash: file.hash })
  })

  route.get('/image/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let hash = sanitize(req.params.id)
    let file = Entity.find(`tag:wiki-image prop:"hash=${hash}"`)
    if (!file) throw "Unknown file";
    if(!Page.validateAccessImage(res, hash, true)) return;

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });
};