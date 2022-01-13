import Entity from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs"

class Page extends Entity {
  
  initNew(id){
    this.id = Page.createId(id);

    this.created = getTimestamp()
    this.tag("wiki")
  }

  static lookup(id) {
    if(!id) return null;
    return Page.find(`tag:wiki prop:id=${id}`)
  }

  static createId(id){
    return id.replace(/^\s+|\s+$/g, '') // trim
             .toLowerCase()
             .replace(/\//g, '-') //Replace / with -
             .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
             .replace(/\s+/g, '-') // collapse whitespace and replace by -
             .replace(/-+/g, '-'); // collapse dashes
  }
}

export default Page