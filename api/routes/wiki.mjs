import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity, {sanitize} from "entitystorage";
import { validateAccess } from "../../../../services/auth.mjs"
import { getTimestamp } from "../../../../tools/date.mjs"
import Page from "../../models/page.mjs"
import Setup from "../../models/setup.mjs";
import Role from "../../../../models/role.mjs";

export default (app) => {

  const route = Router();
  app.use("/wiki", route)

  route.post("/generate-id", (req, res, next) => {
    res.json(Page.createId(req.body.id))
  })

  route.get("/exists", (req, res, next) => {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let id = Page.createId(req.query.id)
    let wiki = id ? Entity.find(`tag:wiki prop:id="${id}"`) : null
    res.json(wiki ? true : false)
  })
  route.get('/search', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    if (!req.query.filter) return []
    let filter = req.query.filter.replace(/[^a-zA-ZæøåÆØÅ0-9 -]/g, '') //Remove invalid chars
    let pages = Entity.search(`tag:wiki (${filter.split(" ").map(w => `(prop:"body~${w}"|prop:"title~${w}"|tag:"user-${w}")`).join(" ")})`)
    res.json(pages.map(p => ({ id: p.id, title: p.title })))
  });

  route.get('/setup', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.setup" })) return;
    res.json(Setup.lookup().toObj());
  });

  route.patch('/setup', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.setup" })) return;
    let setup = Setup.lookup();

    if(req.body.enablePublicPages !== undefined) setup.enablePublicPages = !!req.body.enablePublicPages;

    res.json(true);
  });

  route.get('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id)
    res.json(wiki ? wiki.toObj(res.locals.user) : Page.nullObj(id))
  });

  route.delete('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Entity.find(`tag:wiki prop:"id=${id}"`)
    if (wiki) wiki.delete();
    res.json(true);
  });

  route.patch('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id) || new Page(id)

    if(!wiki.validateAccess(res)) return;

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
    if (req.body.access !== undefined && ["public", "shared", "role", "private"].includes(req.body.access)){
      wiki.access = req.body.access;
      if(req.body.access == "private"){
        wiki.rel(res.locals.user, "owner", true)
      }
    }
    if (req.body.role !== undefined){
      wiki.rel(Role.lookup(req.body.role), "role", true);
    }

    if (wiki.body && !wiki.title) {
      wiki.title = id == "index" ? "Wiki Index" : Page.idToTitle(id)
    }
    if (req.body.tags) {
      let tags = typeof req.body.tags === "string" ? req.body.tags.split(",").map(t => "user-" + t.trim())
        : Array.isArray(req.body.tags)
          ? req.body.tags.map(t => "user-" + t.trim())
          : wiki.tags
      tags.push(...wiki.tags.filter(t => !t.startsWith("user-"))) // Include default tags
      wiki.tag(tags, true);
    }
    wiki.prop("modified", getTimestamp())

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
    let wiki = Entity.find(`tag:wiki prop:"id=${id}"`) || new Entity().tag("wiki").prop("id", id).prop("created", getTimestamp())

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
    let file = Entity.find(`tag:wiki-image prop:"hash=${sanitize(req.params.id)}"`)
    if (!file) throw "Unknown file";

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });
};