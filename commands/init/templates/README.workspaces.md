<% if (project.workspaces) { %>
| **Package** | **Description** | **Version** |
| ----------- | --------------- | ----------- |
<%= project.workspaces.map((ws) =>
`| ${ws.get('name')} | ${ws.get('description') || ''} | ${ws.get('version')} |`
).join('\\n') %>
<% } %>
