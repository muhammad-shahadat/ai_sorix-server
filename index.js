const app = require("./src/app");
const pool = require("./config/db");
const { port } = require("./src/secret");
const { logger } = require("./config/logger");









(async () =>{
    try {

        await pool.query("SELECT NOW()");
        console.log("Database connected successfully");

        app.listen(port, () =>{
            
            console.log(`server is running at http://localhost:${port}`);
        })

    } catch (error) {
        logger.error("Failed to connect to database:", error.message);
        process.exit(1);
        
    }
})();


