<h3 align="center"><%= project.get('name') %></h3>

<% if (project.get('description') { %>
<p align="center">
  <%= project.get('description') %>
</p>
<% } %>

<p align="center">
    <% if (!project.get('private')) { %>
    <a href="https://www.npmjs.com/package/<%= project.get('name') %>">
        <img alt="NPM" src="https://img.shields.io/npm/v/<%= project.get('name') %>.svg?style=flat-square">
    </a>
    <% if (project.get('license')) { %>
    <a href="./LICENSE">
        <img alt="License" src="https://img.shields.io/npm/l/<%= project.get('name') %>.svg?style=flat-square">
    </a>
    <% } %>
    <% } %>
</p>

<% if (!project.get('private')) { %>
## Install

\`\`\`sh
$ npm install <%= project.get('name') %>
# OR
$ yarn add <%= project.get('name') %>
\`\`\`
<% } %>
