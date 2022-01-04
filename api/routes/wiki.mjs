import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity from "entitystorage";
import {getTimestamp} from "../../../../tools/date.mjs"
import Showdown from "showdown"


export let createId = id => id.replace(/^\s+|\s+$/g, '') // trim
                        .toLowerCase()
                        .replace(/\//g, '-') //Replace / with -
                        .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
                        .replace(/\s+/g, '-') // collapse whitespace and replace by -
                        .replace(/-+/g, '-'); // collapse dashes

export let convertBody = md => {
  if(!md) return ""
  let bodyConverted = md.replace(/\[\[([a-zA-Z0-9\-]+)\]\]/g, (grp, pageId) => `[${Entity.find(`tag:wiki prop:id=${pageId}`)?.title||pageId}](/wiki/${pageId})`)
                        .replace(/\[\[(\/[a-zA-Z0-9\-\/\?\&\=]+)\]\]/g, (grp, link) => `[${link.substr(link.lastIndexOf("/")+1)}](${link})`)
  let converter = new Showdown.Converter({
    tables: true,
    simplifiedAutoLink: true,
    simpleLineBreaks: true,
    requireSpaceBeforeHeadingText: true
  })
  return converter.makeHtml(bodyConverted);
}

let templates = [
  {regex: /issue\-([\d]+)/, generate: function (pageId) {
    let issueId = this.regex.exec(pageId)[1]
    let issue = Entity.find(`tag:issue prop:"id=${issueId}"`)
    return `Title: ${issue.title}\n[Open issue](/issue/${issueId})\n\n`
  }},
  {regex: /forum\-thread\-([\d]+)/, generate: function (pageId) {
    let threadId = this.regex.exec(pageId)[1]
    let thread = Entity.find(`tag:forumthread prop:"id=${threadId}"`)
    return `Title: ${thread.title}\n[Open thread](/forum/thread/${thread.id})\n\n`
  }}
]

export default (app) => {

  const route = Router();
  app.use("/wiki", route)

  route.post("/generate-id", (req, res, next) => {
    res.json(createId(req.body.id))
  })

  route.get("/exists", (req, res, next) => {
    let id = createId(req.query.id)
    let wiki = id ? Entity.find(`tag:wiki prop:id=${id}`) : null
    res.json(wiki?true:false)
  })

  route.get("/:id/template", (req, res, next) => {
    let id = createId(req.params.id)
    let template = templates.find(t => t.regex.test(id))
    res.json({id: id, body: template?.generate.call(template, id) || null})
  })

  route.get('/search', function (req, res, next) {
    if(!req.query.filter) return []
    let pages = Entity.search(`tag:wiki (${req.query.filter.split(" ").map(w => `(prop:"body~${w}"|prop:"title~${w}")`).join(" ")})`)
    res.json(pages.map(p => ({id: p.id, title: p.title})))
  });

  route.get('/:id', function (req, res, next) {
    let id = createId(req.params.id)
    let wiki = Entity.find(`tag:wiki prop:id=${id}`)
    let title = id == "index" ? "Wiki Index" : wiki?.title || id.charAt(0).toUpperCase() + id.slice(1).replace(/\-/g, " ")
    if (wiki) {
      if(wiki.body && wiki.html === undefined) wiki.html = convertBody(wiki.body)
      res.json({id: wiki.id, title, body: wiki.body, html: wiki.html||"", exists: true});
    } else {
      res.json({id, title, body: "", html: "", exists: false})
    }
  });

  route.delete('/:id', function (req, res, next) {
    let id = createId(req.params.id)
    let wiki = Entity.find(`tag:wiki prop:id=${id}`)
    if (wiki) wiki.delete();
    res.json(true);
  });

  route.patch('/:id', function (req, res, next) {
    let id = createId(req.params.id)
    let wiki = Entity.find(`tag:wiki prop:id=${id}`) || new Entity().tag("wiki").prop("id", id)
    
    if(req.body.body !== undefined) {
      wiki.body = req.body.body
      wiki.html = convertBody(req.body.body)
    };
    if(req.body.title !== undefined) wiki.title = req.body.title;

    if(wiki.body && !wiki.title){
      wiki.title = id == "index" ? "Wiki Index" : id.charAt(0).toUpperCase() + id.slice(1).replace(/\-/g, " ")
    }

    res.json({id: wiki.id, title: wiki.title||wiki.id, body: wiki.body, html: wiki.html||""});
  });
};