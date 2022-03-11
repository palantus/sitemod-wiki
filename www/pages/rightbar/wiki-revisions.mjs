const elementName = 'rightbar-wiki-revisions-component'

import api from "/system/api.mjs"
import "/components/field.mjs"
import {on, off} from "/system/events.mjs"
import { toggleInRightbar } from "/pages/rightbar/rightbar.mjs"
import {goto, state} from "/system/core.mjs"
import { confirmDialog } from "/components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <style>
    #container{color: white; padding: 10px;}
    h2{margin: 0px; border-bottom: 1px solid lightgray; padding-bottom: 5px; margin-bottom: 10px;}
    #revisions{
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .rev{
      cursor: pointer;
    }
    .rev:hover{
      background-color: #aaa;
    }
    #close{margin-top: 10px;}
  </style>
  <div id="container">
      <h2>Page Revisions</h2>

      <div id="revisions"></div>

      <button id="close">Close</button>
      <button id="delete-revisions">Delete revisions</button>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this)
    this.shadowRoot.getElementById("close").addEventListener("click", () => toggleInRightbar("wiki-revisions", false))
    this.shadowRoot.getElementById("delete-revisions").addEventListener("click", async () => {
      if(!(await confirmDialog("Are you sure that you want to delete the entire revision history?"))) return;
      await api.del(`wiki/${this.pageId}/revisions`)
      this.refreshData()
      if(state().query.revision)
        goto(`/wiki/${this.pageId}`)
    })
    this.shadowRoot.getElementById("revisions").addEventListener("click", e => {
      let id = e.target.closest("div.rev")?.id
      if(!id) return;
      goto(id == "current" ? `/wiki/${this.pageId}` : `/wiki/${this.pageId}?revision=${id}`)
    })
  }

  async refreshData(){
    this.pageId = /\/wiki\/([a-zA-Z]?[a-zA-Z0-9\-]+)/.exec(state().path)?.[1]
    if(!this.pageId) toggleInRightbar("wiki-revisions", false);
    let page = await api.get(`wiki/${this.pageId}`)
    this.shadowRoot.getElementById("revisions").innerHTML = [{id: "current", modified: page.modified}, ...page.revisions.reverse()].map(r => `
      <div class="rev" id="${r.id}">
       ${r.modified.replace("T", " ").substring(0, 19)}${r.id == "current" ? " (active)" : ""}
      </div>
    `).join("")
  }

  connectedCallback() {
    this.refreshData()
    on("changed-page", elementName, this.refreshData)
    on("current-wiki-page-updated", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
    off("current-wiki-page-updated", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}