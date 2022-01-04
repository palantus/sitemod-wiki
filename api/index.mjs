import wiki from './routes/wiki.mjs';

export default (app, graphQLFields) => {

  wiki(app)
  
  return app
}