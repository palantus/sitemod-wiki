import Entity from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs"

class Page extends Entity {
  
  initNew(id){
    this.id = id;

    this.created = getTimestamp()
    this.tag("wiki")
  }

  static lookup(id) {
    if(!id) return null;
    return Page.find(`tag:wiki prop:id=${id}`)
  }
}

export default Page