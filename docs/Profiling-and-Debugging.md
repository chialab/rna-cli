# Using Chrome DevTools

Edit the first line of the `index.js` file in the root of the project as follow:
```diff
-      #! /usr/bin/env node
+      #! /usr/bin/env node --inspect-brk
```

Now, every time the program is launched, the following lines will be printed:
```
Debugger listening on ws://127.0.0.1:9229/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
For help see https://nodejs.org/en/docs/inspector
```

Open Chrome and navigate to `chrome://inspect`. The Node target should be now inspectable.

# Using VS Code

* Open the RNA CLI project in VS Code.
* Select from the `Debug` menu the `Start Debugging` command
* Select Node.js app

This will print in Debug Console:
```
Launch configuration created based on 'package.json'.
Debugging with inspector protocol because Node.js v9.3.0 was detected.
node --inspect-brk=7278 index.js 
Debugger listening on ws://127.0.0.1:7278/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Debugger attached.
```

Once the debugger is started, you can use all VS Code tools for debugging, or use the Chrome DevTools with the provided socket.