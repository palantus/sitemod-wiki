import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity, {sanitize, nextNum, query} from "entitystorage";
import { validateAccess, noGuest } from "../../../../services/auth.mjs"
import { getTimestamp } from "../../../../tools/date.mjs"
import Page from "../../models/page.mjs"
import Setup from "../../models/setup.mjs";
import MySetup from "../../models/setup-mine.mjs";
import { uuidv4 } from "../../../../www/libs/uuid.mjs"

export default (app) => {

  const route = Router();
  app.use("/wiki", route)

  route.post("/generate-id", (req, res, next) => {
    let originalNewId = Page.createId(req.body.id)
    if(!originalNewId) throw "Id not provided"
    let newId = originalNewId
    if(req.body.ensureNew === true){
      let i = 1;
      while(Page.lookup(newId)){
        newId = `${originalNewId}-${i++}`
      }
    }
    res.json(newId)
  })

  route.post("/new-private-document", noGuest, (req, res, next) => {
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
      pages = query.type(Page).tag("wiki").not(query.tag("revision")).tag(`user-${filter.substring(4)}`).all
    } else {
      pages = Page.search(`tag:wiki !tag:revision (${filter.split(" ").map(w => `(prop:"body~${w}"|prop:"title~${w}"|tag:"user-${w}")`).join(" ")})`)
    }
    pages = pages.filter(p => p.validateAccess(res, 'r', false))
    res.json(pages.map(p => ({
      id: p.id, 
      title: p.title, 
      private: !!p.acl?.startsWith("r:private"), 
      tags: p.userTags, 
      mine: p.related.owner?._id == res.locals.user._id,
      modified: p.modified
    })))
  });

  route.get('/setup/mine', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    res.json(MySetup.lookup(res.locals.user).toObj());
  });

  route.patch('/setup/mine', noGuest, function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let setup = MySetup.lookup(res.locals.user)
    res.json(true);
  });

  route.get('/setup', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.setup" })) return;
    res.json(Setup.lookup().toObj());
  });

  route.patch('/setup', noGuest, function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.setup" })) return;
    let setup = Setup.lookup();
    res.json(true);
  });

  route.get('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id, req.query.revision)
    if(wiki && !wiki.validateAccess(res, 'r')) return;
    res.json(wiki ? wiki.toObj(res.locals.user) : Page.nullObj(id, res))
  });

  route.delete('/:id', noGuest, function (req, res, next) {
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
    let wiki = Page.lookup(id);
    if(!wiki && res.locals.user.id != "guest") wiki = new Page(id, res.locals.user)
    else if(!wiki) return res.status(403).json({ error: `Only signed in users can create new pages` });
    if(!wiki && !validateAccess(req, res, { permission: "wiki.create" })) return;
    if(!wiki.validateAccess(res, 'w')) return;

    if (req.body.body !== undefined && req.body.body != wiki.body) {
      wiki.storeRevision(); 
      wiki.body = req.body.body
      wiki.convertBody()

      // Update file references:
      let files = [...wiki.html.matchAll(/(\/image\/([\da-zA-Z]+))/g)].map(i => i[2]).map(id => query.tag("wiki-image").prop("hash", id).first).filter(f => f != null)
      let ids = files.map(f => f._id)
      for (let r of wiki.rels.image || []) {
        if (!ids.includes(r._id)) {
          wiki.removeRel(r, "image")
          if (!r.relsrev.image)
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

    if(res.locals.user.id != "guest"){
      if (req.body.tags !== undefined) {
        let tags = typeof req.body.tags === "string" ? req.body.tags.split(",").map(t => "user-" + t.trim())
          : Array.isArray(req.body.tags)
            ? req.body.tags.map(t => "user-" + t.trim())
            : wiki.tags
        tags.push(...wiki.tags.filter(t => !t.startsWith("user-"))) // Include default tags
        wiki.tag(tags, true);
      }

      switch(req.body.access){
        case "public": wiki.acl = "r:public;w:private"; break;
        case "shared": wiki.acl = "r:shared;w:private"; break;
        case "private": wiki.acl = "r:private;w:private"; break;
      }

      if(!wiki.related.owner){
        wiki.rel(res.locals.user, "owner")
      }
    }
    wiki.prop("modified", getTimestamp())

    res.json({ id: wiki.id, title: wiki.title || wiki.id, body: wiki.body, html: wiki.html || "" });
  });

  route.post('/:id/tags/:tag', noGuest, function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id);
    if(!wiki) throw "Unknown page"
    if(!wiki.validateAccess(res, 'w')) return;
    let tag = sanitize(req.params.tag)
    if(!tag) throw "invalid tag"
    wiki.tag(`user-${tag}`)
    res.json({success: true})
  })

  route.delete('/:id/tags/:tag', noGuest, function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id);
    if(!wiki) throw "Unknown page"
    if(!wiki.validateAccess(res, 'w')) return;
    let tag = sanitize(req.params.tag)
    if(!tag) throw "invalid tag"
    wiki.removeTag(`user-${tag}`)
    res.json({success: true})
  })

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
    let wiki = Page.lookup(id);
    if(!wiki && res.locals.user.id != "guest") wiki = new Page(id, res.locals.user)
    else if(!wiki) return res.status(403).json({ error: `Only signed in users can create new pages` });
    if(!wiki.validateAccess(res, 'w')) return;

    let file = query.tag("wiki-image").prop("hash", f.md5).first

    if (!file) {
      let shareKey = uuidv4();
      file = new Entity().tag("wiki-image")
        .prop("name", f.name)
        .prop("size", f.size)
        .prop("hash", f.md5)
        .prop("mime", f.mimetype)
        .prop("shareKey", shareKey)
        .prop("timestamp", getTimestamp())
        .setBlob(f.data)
    }

    wiki.rel(file, "image")
    res.json({ hash: file.hash })
  })

  route.delete("/:id/revisions", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.edit" })) return;
    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id);
    if(!wiki) return res.status(404).json({ error: `Page doesn't exist` });
    if(!wiki.validateAccess(res, 'w')) return;
    if(wiki.related.owner?.id != res.locals.user.id && !res.locals.permissions.includes("admin")) return res.status(403).json({ error: `Only page owner can clear page revisions` });
    wiki.revisions.forEach(r => r.delete())
    res.json({success: true})
  })

  route.get('/image/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    let hash = sanitize(req.params.id)
    let file = query.tag("wiki-image").prop("hash", hash).first
    if (!file) throw "Unknown file";
    if(file.shareKey && res.locals.shareKey != file.shareKey) return res.status(403).json({ error: `You do not have access to this image` });

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });

  route.get('/', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "wiki.read" })) return;
    res.json(Page.all()
                 .filter(p => p.hasAccess(res.locals.user, 'r', res.locals.shareKey))
                 .map(p => ({ id: p.id, title: p.title, private: !!p.acl?.startsWith("r:private"), mine: p.related.owner?._id == res.locals.user._id  })))
  });
};