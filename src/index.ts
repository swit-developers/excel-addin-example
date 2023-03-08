// https://localhost:3000/oauth/authorize?dialog=L29hdXRoLWRpYWxvZy5odG1s

import { SwitTokenObject, SwitResponseBody } from "./express.dto";

// Import builtin NodeJS modules to instantiate the service
import https from "https";
import fs from "fs";
import jwt, { JwtPayload } from "jsonwebtoken";
import path from "path";
import fetch, {
    Request as FetchRequest,
    Response as FetchResponse
} from "node-fetch-commonjs";

// Get the environment variables
require("dotenv").config();
const CLIENT_ID = process.env.CLIENT_ID ?? 
    (() => { throw new Error('Missing required environment variable: CLIENT_ID') })();
const CLIENT_SECRET = process.env.CLIENT_SECRET ??
    (() => { throw new Error('Missing required environment variable: CLIENT_SECRET') })();

// Server config
import express, {Request, Response} from "express";
const app = express();

// Apply security best practices with helmet middleware
import helmet from 'helmet';
app.use(helmet());

// Apply gzip compression to improve performance
import compression from 'compression';
app.use(compression());

// Get request body
app.use(express.json());

// HTML Directory of static resources ./html
const htmlDirectory = path.join(__dirname, "../client/dist");
app.use("/", express.static(htmlDirectory));

// Add cookie parser
import cookieParser from "cookie-parser";
app.use(cookieParser());

// Database
const sqlite3 = require("sqlite3").verbose();
const dataDirectory = path.join(__dirname, "../.data");
if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory);
}
const db = new sqlite3.Database(path.join(dataDirectory, "swit-tasks.db"));
db.run(
    "CREATE TABLE IF NOT EXISTS tokens (client_token TEXT UNIQUE, user_id VARCHAR(20), expires_at INTEGER, access_token TEXT, refresh_token TEXT)",
    (err: { message: any; }) => {
        if (err) console.log(err.message);
    }
);
db.query = function (sql: any, params: any) {
    var that = this;
    return new Promise(function (resolve, reject) {
        that.all(sql, params, function (error: any, rows: any) {
            if (error) reject(error);
            else resolve({ rows: rows });
        });
    });
};

// get authorization code
interface AuthorizeRequest extends Request {
    query: {
        dialog: string;
    };
}
app.get("/oauth/authorize", (req: AuthorizeRequest, res: Response) => {
    const { dialog } = req.query;
    const host = req.protocol + "://" + req.get("host");
    const authorizeUrl = new URL("https://openapi.swit.io/oauth/authorize");
    authorizeUrl.searchParams.append("client_id", CLIENT_ID);
    authorizeUrl.searchParams.append("redirect_uri", host + "/oauth/token");
    authorizeUrl.searchParams.append("response_type", "code");
    authorizeUrl.searchParams.append(
        "scope",
        "user:read workspace:read project:read task:write"
    );
    authorizeUrl.searchParams.append("state", dialog);
    return res.redirect(authorizeUrl.href);
});

// get access token
interface TokenRequest extends Request {
    query: {
        code: string;
        state: string;
    };
}
app.get("/oauth/token", async (req: TokenRequest, res: Response) => {
    const { code, state } = req.query;
    const host = req.protocol + "://" + req.get("host");
    const tokenResponse = await fetch("https://openapi.swit.io/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: host + req.path,
            code: code,
        }),
    });
    const tokenObject = await tokenResponse.json() as SwitTokenObject;

    // parse the jwt token
    const decoded = jwt.decode(tokenObject.access_token) as JwtPayload;

    // create a client token to identify the client
    const client_token = jwt.sign(
        {
            swit_id: decoded.sub,
        },
        "swit-tasks"
    );

    // save the token to the database
    db.run(
        `INSERT INTO tokens VALUES (?, ?, ?, ?, ?)`,
        [
            client_token,
            decoded.sub,
            decoded.exp,
            tokenObject.access_token,
            tokenObject.refresh_token,
        ],
        function (err: { message: any; }) {
            if (err) {
                return console.log(err.message);
            }
            // get the last insert id
            console.log(`A row has been inserted with rowid ${this.lastID}`);
        }
    );

    const dialogUrl = new URL(host);
    dialogUrl.pathname = atob(state);
    dialogUrl.searchParams.append("token", tokenObject.access_token);
    // add an httpOnly cookie to the response with 30 days expiration
    res.cookie("client_token", client_token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "none",
        secure: true,
    });
    return res.redirect(dialogUrl.href);
});

// Refresh the access token
async function refreshAccessToken(req: Request) {
    const refreshToken = await getSwitToken(req, true);
    const tokenResponse = await fetch("https://openapi.swit.io/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: refreshToken,
        }),
    });
    const tokenObject = await tokenResponse.json() as SwitTokenObject;
    if (!tokenResponse.ok) {
        console.log(tokenObject);
        return false;
    }

    // Update the access and refresh tokens in the database based on the client token
    db.run(
        `UPDATE tokens SET access_token = ?, refresh_token = ? WHERE client_token = ?`,
        [
            tokenObject.access_token,
            tokenObject.refresh_token,
            req.cookies.client_token,
        ],
        function (err: { message: any; }) {
            if (err) {
                console.log(err.message);
                return false;
            }
            // get the last insert id
            console.log(`A row has been updated with rowid ${this.lastID}`);
        }
    );
    return true;
}

// Sign the user out to delete the cookie and the token from the database
app.post("/api/signout", (req, res) => {
    db.run(
        `DELETE FROM tokens WHERE client_token = ?`,
        [req.cookies.client_token],
        function (err: { message: any; }) {
            if (err) {
                console.log(err.message);
                return false;
            }
            // get the last insert id
            console.log(`A row has been deleted with rowid ${this.lastID}`);
        }
    );
    res.clearCookie("client_token");
    return res.status(204).send();
});

// Get authenticated user
app.get("/api/user", async (req: Request, res: Response) => {
    return await callToSwit(
        req, res,
        async (token) => {
            return await fetch(
                `https://openapi.swit.io/v1/api/user.info`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
        },
        async (switResponse) => {
            const data = await switResponse.json() as SwitResponseBody;
            return res.json(data.data.user);
        }
    );
});

// Get Swit workspaces
app.get("/api/workspaces", async (req, res) => {
    // get the cookies from the request
    const response = await getPagedSwitData(req, res, "workspace");
    return response;
});

// Get Swit projects
interface ProjectsRequest extends Request {
    query: {
        workspace_id: string;
    };
}
app.get("/api/projects", async (req: ProjectsRequest, res: Response) => {
    const {workspace_id} = req.query;
    const response = await getPagedSwitData(
        req,
        res,
        "project",
        workspace_id
    );
    return response;
});

// Get Swit data
async function getPagedSwitData(req: Request, res: Response, resourceType: string, workspaceId?: string) {
    return await callToSwit(
        req, res,
        async (token) => {
            const limit = 100;
            const getItems = async (items: any[] = [], offset: string = "", retry: number = 0) => {
                const switResponse = await fetch(
                    `https://openapi.swit.io/v1/api/${resourceType}.list?limit=${limit}&offset=${offset}` +
                        (workspaceId ? `&workspace_id=${workspaceId}` : ""),
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
                const data = await switResponse.json() as SwitResponseBody;
                if (switResponse.status === 429 && retry < 3) {
                    console.log("retrying");
                    await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000));
                    return getItems(items, offset, retry + 1);
                }else if (!switResponse.ok) {
                    throw new UnsuccessfulResponseError(
                        JSON.stringify(data),
                        switResponse.status
                    );
                }
                const currentItems = data.data.workspaces || data.data.projects;
                // concatenate currentItems to items
                items.push(...currentItems);
                if(currentItems.length >= limit) {
                    return getItems(items, data.data.offset);
                }
                return items;
            };
            const items = await getItems();
            const craftedFetchResponse = new FetchResponse(JSON.stringify({
                items: items,
            }));
            return craftedFetchResponse;
        },
        async (switResponse) => {
            const data = await switResponse.json();
            return res.json(data);
        }
    );
}

// Create Swit tasks
app.post("/api/tasks", async (req: Request, res: Response) => {
    return await callToSwit(
        req, res,
        async (token) => {
            // create a task
            return await fetch(
                `https://openapi.swit.io/v1/api/task.create`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: JSON.stringify(req.body),
                }
            );
        },
        async () => {
            return res.status(204).send();
        }
    );
});

// Error handler
class UnsuccessfulResponseError extends Error {
    status: number;
    constructor(
        message: string,
        status: number
        ) {
        super(message);
        switch (status) {
            case 401:
                this.name = "UnauthorizedError";
                break;
            case 429:
                this.name = "TooManyRequestsError";
                break;
            default:
                this.name = "UnsuccessResponseError";
        }
        this.status = status;
    }
}

// Implement an API call to Swit
async function callToSwit(
    req: Request,
    res: Response,
    requestHandler: (token: string) => Promise<FetchResponse>,
    responseHandler: (switResponse: FetchResponse) => Promise<Response>,
    retry: number = 0
) {
    try {
        const token = await getSwitToken(req);
        const switResponse = await requestHandler(token);
        if (!switResponse.ok) {
            const result = await switResponse.json();
            throw new UnsuccessfulResponseError(
                JSON.stringify(result),
                switResponse.status
            );
        }
        return responseHandler(switResponse);
    } catch (err) {
        if (err.name === "UnauthorizedError" && retry < 1) {
            const refreshResult = await refreshAccessToken(req);
            if (refreshResult) {
                console.log("Access token refreshed");
                return callToSwit(req, res, requestHandler, responseHandler, retry + 1);
            } else {
                console.log("Refresh token is not valid");
            }
        } else if (err.name === "TooManyRequestsError" && retry < 3) {
            // Wait for 1 second and retry
            await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000));
            return callToSwit(req, res, requestHandler, responseHandler, retry + 1);
        }
        return res.status(err.status || 500).send(err.message);
    }
}

// Function to get Swit token
async function getSwitToken(req: Request, refresh = false) {
    try {
        // Get the access token from the database
        const tokenColumnName = refresh ? "refresh_token" : "access_token";
        const tokenRecords = await db.query(
            `SELECT ${tokenColumnName} FROM tokens WHERE client_token = ?`,
            [req.cookies.client_token]
        );
        const token = tokenRecords.rows[0][tokenColumnName];
        return token;
    } catch (err) {
        console.log(err.message);
        return;
    }
}

// Determine whether to use a self-signed certificate or not
if (process.env.NODE_ENV === 'production') {
    // Start the server using HTTPS with a real SSL certificate
    const PORT = 8080;
    const HOST = '0.0.0.0';
    app.listen(PORT, HOST, () => {
        console.log(`App listening on http://${HOST}:${PORT}`);
    });
} else {
    // Start the server using a self-signed certificate for local development
    const PORT = 3000;
    https
        .createServer(
            {
                key: fs.readFileSync(path.join(__dirname, "../key.pem")),
                cert: fs.readFileSync(path.join(__dirname, "../cert.pem")),
            },
            app
        )
        .listen(PORT, () => {
            console.log(`Express is running on https://localhost:${PORT}`);
        });
}