import mysql from "mysql2/promise";
class MySQL {
    private pool: mysql.Pool;
    constructor() {
        console.log("MySQL used.");
        this.pool = mysql.createPool({
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            socketPath: `/cloudsql/${process.env.DB_CONNECTION_NAME}`
        });
    }
    // retrieve records asynchronously
    async get(
        sqlStatement: string,
        values?: any[]
    ): Promise<any[]> {
        const connection = await this.pool.getConnection();
        try {
            const rows = await connection.query(sqlStatement, values);
            if (Array.isArray(rows)) {
                return rows;
            } else {
                throw new Error("Unexpected result");
            }
        } finally {
            connection.release();
        }
    }
    async set(
        sqlStatement: string,
        values?: any[]
    ): Promise<void> {
        const connection = await this.pool.getConnection();
        try {
            await connection.query(sqlStatement, values);
            await connection.commit();
        } catch (error) {
            // rollback the transaction if an error occurs
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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
// export default Database;
const Database = process.env.DB_CONNECTION_NAME ? MySQL : Sqlite3;
export default Database;
