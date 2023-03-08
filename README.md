# Excel Addin Example

This project contains both server-side and client-side components.

- Server-side: Stored in the root directory.
- Client-side: Stored in the `./client` directory.

1. Install dependencies in both the server and client directories.

    ```
    npm run install-all
    ```

2. Create a self-signed certificate. You need to execute OpenSSL from your device.

    ```
    npm run generate-cert
    ```

3. Run the scripts in test mode.

    - To run the server side, execute the following from the project directory.

        ```
        npm start
        ```

    - To run the client side, open a new terminal and execute the following:

        ```
        cd client
        npm run watch
        ```