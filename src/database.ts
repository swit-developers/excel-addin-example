require("dotenv").config();
import mysql from 'mysql2';
class MySQL {
    private connection: mysql.Connection;
    constructor() {
        console.log("MySQL used.");
        this.connection = mysql.createConnection({
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            socketPath: process.env.DB_CONNECTION_NAME ? `/cloudsql/${process.env.DB_CONNECTION_NAME}`: null
        });
        
    }
    // retrieve records asynchronously
    async get(
        sqlStatement: string,
        values?: any[]
    ): Promise<any[]> {
        const that = this;
        return new Promise(function (resolve, reject) {
            that.connection.query(sqlStatement, values, function (error: any, rows: any[] ) {
                if (error) reject(error);
                else resolve(rows);
            });
        });
    }
    async set(
        sqlStatement: string,
        values?: any[]
    ): Promise<void> {
        this.connection.beginTransaction((error: any) => {
            if (error) throw error;
            this.connection.query(sqlStatement, values, (error: any, results: any, fields: any) => {
                if (error) {
                    return this.connection.rollback(() => {
                        throw error;
                    });
                }
                this.connection.commit((error: any) => {
                    if (error) {
                        return this.connection.rollback(() => {
                            throw error;
                        });
                    }
                    console.log('Transaction Complete.');
                });
            });
        });
    }
}

import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
class Sqlite3 {
    private sqlite3Database: sqlite3.Database;
    constructor() {
        console.log("Sqlite3 used.");
        const dataDirectory = path.join(__dirname, "../.data");
        if (!fs.existsSync(dataDirectory)) {
            fs.mkdirSync(dataDirectory);
        }
        this.sqlite3Database = new sqlite3.Database(path.join(dataDirectory, "swit-tasks.db"));
    }
    async get(
        sqlStatement: string,
        values?: any[]
    ): Promise< any[] > {
        const that = this;
        return new Promise(function (resolve, reject) {
            that.sqlite3Database.all(sqlStatement, values, function (error: any, rows: any[] ) {
                if (error) reject(error);
                else resolve(rows);
            });
        });
    }
    async set(
        sqlStatement: string,
        values?: any[]
    ): Promise<void> {
        this.sqlite3Database.run(
            sqlStatement,
            values,
            (err: { message: any; }) => {
                if (err) console.log(err.message);
            }
        );
    }
}
const Database = process.env.DB_CONNECTION_NAME ? MySQL : Sqlite3;
// const Database = MySQL;
export default Database;
