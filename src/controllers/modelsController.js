const createError = require("http-errors");

const pool = require("../../config/db");
const { successResponse } = require("./responseController");



const handleGetModels = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT slug, display_name, provider, type, max_tokens, priority
            FROM models 
            WHERE is_active = true 
            ORDER BY type, priority DESC
        `);

        return successResponse(res, {
            statusCode: 200,
            message: "All active models fetched successfully",
            payload: result.rows
        });
    } catch (err) {
        next(err);
    }
};

const handleGetTextModels = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT slug, display_name, provider, max_tokens, priority
            FROM models 
            WHERE type = 'text' AND is_active = true 
            ORDER BY priority DESC
        `);

        return successResponse(res, {
            statusCode: 200,
            message: "Text models fetched successfully",
            payload: result.rows
        });
    } catch (err) {
        next(err);
    }
};

const handleGetImageModels = async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT slug, display_name, provider, priority
            FROM models 
            WHERE type = 'image' AND is_active = true 
            ORDER BY priority DESC
        `);

        return successResponse(res, {
            statusCode: 200,
            message: "Image models fetched successfully",
            payload: result.rows
        });
    } catch (err) {
        next(err);
    }
};

const handleGetModel = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const result = await pool.query(
            `SELECT slug, display_name, provider, max_tokens, type 
             FROM models 
             WHERE slug = $1 AND is_active = true`,
            [slug]
        );

        if (result.rows.length === 0) {
            return next(createError(404, "Model not found or inactive"));
        }

        return successResponse(res, {
            statusCode: 200,
            message: "Model fetched successfully",
            payload: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    handleGetModels,
    handleGetTextModels,
    handleGetImageModels,
    handleGetModel
};