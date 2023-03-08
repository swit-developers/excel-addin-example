# Excel Addin Example


## Configure a Swit OAuth app

1. Visit https://developers.swit.io and create a new app.
2. Under **Features**, go to **Authentication**.
3. Add `https://localhost:3000/oauth/token` to **Allowed redirect URLs**.
4. Take note of the client ID and client secret for the next procedure.


## Build a local deplopyment

1. Clone this project to your device.

   - This project contains both server-side and client-side components.

     - Server-side: Stored in the root directory.
     - Client-side: Stored in the `./client` directory.

2. Create a new file named `.env` in the root directory and add the client ID and client secret mentioned in the above section as follows:
   
    ```
    CLIENT_ID={YOUR_CLIENT_ID}
    CLIENT_SECRET={YOUR_CLIENT_SECRET}
    ```

3. Install dependencies in both the server and client directories.

    ```
    npm run install-all
    ```

4. Create a self-signed certificate. You need to execute OpenSSL from your device.

    ```
    npm run generate-cert
    ```

5. Run the scripts in test mode.

    - To run the server side, execute the following from the project directory.

        ```
        npm start
        ```

    - To run the client side, open a new terminal and execute the following:

        ```
        cd client
        npm run watch
        ```

## Test in an Excel document

1. Open a file on the web Excel.
2. Under **Insert**, click **Add-ins**, then **Upload My Add-in**.

   ![image](https://user-images.githubusercontent.com/61765788/223762089-7107cb84-6929-4421-8b98-92350f0f9890.png)

3. Upload the **manifest.xml** file from the `client/dist` directory.
4. Move to the **Home** ribbon, and launch the **Import tasks** add-in.
5. In the add-in, sign in to your Swit account and create a template.
6. In each row, fill in the details of the task to add.

   - Make sure each column has the data format specified at https://developers.swit.io/documentation#create-a-task.
