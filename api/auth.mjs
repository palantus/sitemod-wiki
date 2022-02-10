import Setup from "../models/setup.mjs";
import Page from "../models/page.mjs";
import Entity, { sanitize} from "entitystorage";

export default (app) => {
  let setup = Setup.lookup()

  app.get('/wiki/:id', function (req, res, next) {
    if(!setup.enablePublicPages) return next();

    let id = Page.createId(req.params.id)
    let wiki = Page.lookup(id)
    if(!wiki?.validateAccess(res, false)) return next();

    res.json(wiki ? wiki.toObj(res.locals.user) : Page.nullObj(id, res))
  });

  app.get('/wiki/image/:id', function (req, res, next) {
    if(!setup.enablePublicPages) return next();
    let hash = sanitize(req.params.id);
    let file = Entity.find(`tag:wiki-image prop:"hash=${hash}"`)
    if (!file) throw "Unknown file";
    if(!Page.validateAccessImage(res, hash, false)) return next();

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });
}
