Working on a WebApp may requires a lot of dependencies. Some of them are maybe developed by your own team, and troubleshooting  the integration is just right the corner. Since RNA will bundle the application using distribution files of a library, the bug fixing could be a real pain.

### The "old-school" path

1. Find a bug in WebApp's dependency
2. Open the dependency project

    1. Fix the bug
    2. Build the project
    3. Release a new version of the project

3. Update WebApp's dependencies
4. Still not working, repeat from step 1 😭

### The `yarn link` path

1. Find a bug in WebApp's dependency
2. Open the dependency project

    1. Create a dependency link with
    2. Start RNA build task in watch mode

    ```
    $ yarn link
    $ rna build --watch
    ```

3. Link the dependency in the WebApp project
    ```
    $ yarn link <dependency name>
    ```
4. Edit your dependency directly from the `node_modules` folder: RNA will regenerate distribution files of the dependency on every change.