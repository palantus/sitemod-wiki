import {goto} from "/system/core.mjs"
import {Command, removeKeywordsFromQuery} from "/pages/tools/command-palette/command.mjs"

export class OpenWikiPage extends Command{
  static keywords = [
    {word: "wiki", mandatory: true}
  ]

  static createInstances(context){
    if(!context.userPermissions.includes("wiki.read")) return []
    let query = removeKeywordsFromQuery(context.query, this.keywords)
    
    let pageId = query.join("-")
    if(!pageId) return []

    let cmd = new OpenWikiPage()
    cmd.pageId = pageId;
    cmd.context = context;
    cmd.title = `Show wiki page: ${pageId}`
    return cmd
  }

  async run(){
    goto(`/wiki/${this.pageId}`)
  }
}

export class SearchWiki extends Command{
  static keywords = [
    {word: "wiki", mandatory: true},
    {words: ["s", "search", "find"], mandatory: false}
  ]

  static createInstances(context){
    if(!context.userPermissions.includes("wiki.read")) return []
    let query = removeKeywordsFromQuery(context.query, this.keywords)
    
    let filter = query.join(" ")

    let cmd = new SearchWiki()
    cmd.filter = filter;
    cmd.context = context;
    cmd.title = `Search wiki for: ${filter}`
    return cmd
  }

  async run(){
    goto(`/wiki-search?filter=${this.filter}`)
  }
}
