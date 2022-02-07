import Setup from "../models/setup.mjs";
import Page from "../models/page.mjs";
import Entity, { sanitize} from "entitystorage";

export default (app) => {
  let setup = Setup.lookup()

  app.get('/wiki/:id', function (req, res, next) {
    if(!setup.enablePublicPages) return next();

    let wiki = Page.lookup(Page.createId(req.params.id))
    if(!wiki?.tags.includes("user-public")) return next()

    res.json(wiki ? wiki.toObj(res.locals.user) : Page.nullObj())
  });

  app.get('/wiki/image/:id', function (req, res, next) {
    if(!setup.enablePublicPages) return next();
    let hash = sanitize(req.params.id);
    let file = Entity.find(`tag:wiki-image prop:"hash=${hash}"`)
    if (!file) throw "Unknown file";

    let page = Page.search(`tag:wiki tag:user-public image.prop:"hash=${hash}"`)
    if(!page) return next();

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });
}
