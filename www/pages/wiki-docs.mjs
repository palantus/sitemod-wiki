const elementName = 'wiki-docs-page'

import {goto} from "/system/core.mjs"
import api from "/system/api.mjs"
import "/components/field-ref.mjs"
import {on, off} from "/system/events.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/action-bar-menu.mjs"

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
      <action-bar-item class="hidden" id="new-btn">New personal</action-bar-item>
      <action-bar-item id="options-menu" class="hidden">
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
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);

    this.shadowRoot.getElementById("new-btn").addEventListener("click", () => api.post("wiki/new-private-document").then(p => goto(`/wiki/${p.id}`)))
  }

  async refreshData(){
    let results = await api.get(`wiki/search?filter=tag:doc`)
    this.shadowRoot.getElementById("private").innerHTML = results.filter(p => p.private)
                                                                 .sort((a, b) => (a.title||a.id)?.toLowerCase() < (b.title||b.id)?.toLowerCase() ? -1 : 1)
                                                                 .map(p => `
      <tr class="result">
        <td><field-ref ref="/wiki/${p.id}">${p.title || p.id}</field-ref></td>
      </tr>
    `).join("")

    this.shadowRoot.getElementById("shared").innerHTML = results.filter(p => !p.private)
                                                                 .sort((a, b) => (a.title||a.id)?.toLowerCase() < (b.title||b.id)?.toLowerCase() ? -1 : 1)
                                                                 .map(p => `
      <tr class="result">
        <td><field-ref ref="/wiki/${p.id}">${p.title || p.id}</field-ref></td>
      </tr>
    `).join("")
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