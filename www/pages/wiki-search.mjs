const elementName = 'wiki-search-page'

import {state, pushStateQuery} from "../system/core.mjs"
import api from "../system/api.mjs"
import "../components/field-ref.mjs"
import {on, off} from "../system/events.mjs"

export let stateColors = {error: "red", timeout: "red", done: "green", ready: "blue", hold: "blue", running: "green"}

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <link rel='stylesheet' href='/css/searchresults.css'>
  <style>
    #container{
        /*padding-top: 55px;*/
        position: relative;
    }
    table{
      width: 100%;
    }
    table thead tr{
      border-bottom: 1px solid gray;
    }

    table thead th:nth-child(1){width: 250px}
    table thead th:nth-child(2){width: 120px}
  </style>

  <div id="container">
    <input id="search" type="text" placeholder="Enter query" value=""></input>
    <span id="resultinfo"></span>
    <table>
        <thead>
            <tr>
              <th>Title</th>
              <th>Tags</th>
              <th>Private</th>
            </tr>
        </thead>
        <tbody id="results">
        </tbody>
    </table>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.clearAndRefreshData = this.clearAndRefreshData.bind(this);
    this.queryChanged = this.queryChanged.bind(this);
        
    this.shadowRoot.getElementById('search').addEventListener("change", () => {
      this.queryChanged()
      pushStateQuery(this.lastQuery ? {filter: this.lastQuery} : undefined)
    })

    this.query = ""
    
  }

  async clearAndRefreshData(){
    let results = this.lastQuery ? await api.get(`wiki/search?filter=${this.lastQuery}`) : []
    this.shadowRoot.getElementById("results").innerHTML = results.sort((a, b) => a.title?.toLowerCase() < b.title?.toLowerCase() ? -1 : 1)
                                                                 .map(p => `
      <tr class="result">
        <td><field-ref ref="/wiki/${p.id}">${p.title}</field-ref></td>
        <td>${p.tags.join(", ")}</td>
        <td>${p.private ? "&#10004;" : ""}</td>
      </tr>
    `).join("")
  }

  queryChanged(q = this.shadowRoot.querySelector('input').value){
    if(q == this.lastQuery) return;
    this.lastQuery = q;
    this.shadowRoot.querySelector('input').value = q;
    this.clearAndRefreshData();
  }

  connectedCallback() {
    this.shadowRoot.querySelector('input').focus();
    this.queryChanged(state().query.filter||"");
    
    on("changed-page-query", elementName, (query) => this.queryChanged(query.filter || ""))
    on("changed-project", elementName, this.clearAndRefreshData)
    on("changed-page", elementName, this.clearAndRefreshData)
  }

  disconnectedCallback() {
    off("changed-page-query", elementName)
    off("changed-project", elementName)
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}