const elementName = 'wiki-docs-page'

import {goto} from "/system/core.mjs"
import api from "/system/api.mjs"
import "/components/field-ref.mjs"
import {on, off} from "/system/events.mjs"
import {userPermissions} from "/system/user.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/action-bar-menu.mjs"
import { showDialog } from "/components/dialog.mjs"

export let stateColors = {error: "red", timeout: "red", done: "green", ready: "blue", hold: "blue", running: "green"}

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <link rel='stylesheet' href='/css/searchresults.css'>
  <style>
    #container{
        /*padding-top: 55px;*/
        position: relative;
        padding: 10px;
    }
    table{
      width: 100%;
    }
    table thead tr{
      border-bottom: 1px solid gray;
    }

    table thead th:nth-child(1){width: 150px}
  </style>

  <action-bar id="action-bar" class="hidden">
      <action-bar-item id="new-btn">New personal</action-bar-item>
      <action-bar-item id="options-menu">
        <action-bar-menu label="Help">
          <p>Add the tag "doc" to any shared wiki page, to make it appear in shared documents. If you add it to a private wiki page, it will appear among your documents.</p>
        </action-bar-menu>
      </action-bar-item>
  </action-bar>
  <div id="container">
    <h2>Mine:</h2>
    <table>
        <thead>
            <tr>
              <th>Title</th>
            </tr>
        </thead>
        <tbody id="private">
        </tbody>
    </table>

    <br>
    <h2>Shared:</h2>
    <table>
        <thead>
            <tr>
              <th>Title</th>
            </tr>
        </thead>
        <tbody id="shared">
        </tbody>
    </table>
  </div>

  <dialog-component title="New document" id="new-dialog">
    <field-component label="Title"><input id="new-title"></input></field-component>
  </dialog-component>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
    this.newClicked = this.newClicked.bind(this)

    this.shadowRoot.getElementById("new-btn").addEventListener("click", this.newClicked)

    userPermissions().then(permissions => {
      this.shadowRoot.getElementById("action-bar").classList.toggle("hidden", !permissions.includes("wiki.create"))
    })
  }

  async refreshData(){
    let results = await api.get(`wiki/search?filter=tag:doc`)
    this.shadowRoot.getElementById("private").innerHTML = results.filter(p => p.mine)
                                                                 .sort((a, b) => (a.title||a.id)?.toLowerCase() < (b.title||b.id)?.toLowerCase() ? -1 : 1)
                                                                 .map(p => `
      <tr class="result">
        <td><field-ref ref="/wiki/${p.id}">${p.title || p.id}</field-ref></td>
      </tr>
    `).join("")

    this.shadowRoot.getElementById("shared").innerHTML = results.filter(p => !p.mine)
                                                                 .sort((a, b) => (a.title||a.id)?.toLowerCase() < (b.title||b.id)?.toLowerCase() ? -1 : 1)
                                                                 .map(p => `
      <tr class="result">
        <td><field-ref ref="/wiki/${p.id}">${p.title || p.id}</field-ref></td>
      </tr>
    `).join("")
  }

  newClicked(){
    let dialog = this.shadowRoot.querySelector("#new-dialog")

    showDialog(dialog, {
      show: () => this.shadowRoot.querySelector("#new-title").focus(),
      ok: async (val) => {
        let id = await api.post("wiki/generate-id", {id: val.title, ensureNew: true})
        await api.patch(`wiki/${id}`, {id, ...val, access: "private", tags: ["doc"]})
        goto(`/wiki/${id}`)
      },
      validate: (val) => 
          !val.title ? "Please fill out title"
        : true,
      values: () => {return {
        title: this.shadowRoot.getElementById("new-title").value
      }},
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  connectedCallback() {
    
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}