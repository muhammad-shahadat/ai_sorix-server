const createError = require("http-errors");
const cloudinary = require("../../config/cloudinary");

const { successResponse } = require("./responseController");





const handleUploadSignature = (req, res, next) => {
    try {
        const userId = req.user.id;

        const timestamp = Math.round(new Date().getTime() / 1000);

        const params = {
            timestamp: timestamp,
            folder: `ai-sorix/users/${userId}`,
            resource_type: "auto" // auto detect (image, video, pdf, raw)
        };

        const signature = cloudinary.utils.api_sign_request(
            params,
            process.env.CLOUDINARY_API_SECRET
        );

        return successResponse(res, {
            statusCode: 200,
            message: "Upload signature generated successfully",
            payload: {
                signature,
                timestamp,
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                apiKey: process.env.CLOUDINARY_API_KEY,
                folder: `ai-sorix/users/${userId}`
            }
        });

    } catch (err) {
        console.error("Signature Error:", err);
        next(createError(500, "Failed to generate upload signature"));
    }
};


const handleSaveFileToDB = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const {
            public_id,
            secure_url,
            original_filename,
            format,
            bytes,
            resource_type = "raw", // image, video, raw, auto
            width,
            height
        } = req.body;

        // বাধ্যতামূলক ফিল্ড চেক
        if (!secure_url || !original_filename || !bytes) {
            return next(createError(400, "Missing required fields: secure_url, original_filename or bytes"));
        }

        // MIME টাইপ তৈরি করা
        const mime_type = resource_type === "image" 
            ? `image/${format}` 
            : resource_type === "video"
            ? `video/${format}`
            : resource_type === "raw"
            ? "application/octet-stream"
            : `${resource_type}/${format}`;

        // ডাটাবেসে সেভ করা
        const result = await pool.query(
            `INSERT INTO files 
                (user_id, storage_path, original_name, mime_type, size_bytes, file_hash)
             VALUES 
                ($1, $2, $3, $4, $5, $6)
             RETURNING id, storage_path, original_name, mime_type, size_bytes, uploaded_at`,
            [
                userId,
                secure_url,
                original_filename,
                mime_type,
                bytes,
                public_id // file_hash এর জায়গায় public_id রাখলাম (ডুপ্লিকেট চেক করতে সুবিধা)
            ]
        );

        const savedFile = result.rows[0];

        return successResponse(res, {
            statusCode: 201,
            message: "File saved to database successfully",
            payload: {
                file_id: savedFile.id,
                url: savedFile.storage_path,
                name: savedFile.original_name,
                mime_type: savedFile.mime_type,
                size_bytes: savedFile.size_bytes,
                uploaded_at: savedFile.uploaded_at
            }
        });

    } catch (err) {
        // ডুপ্লিকেট ফাইল হলে (public_id ইউনিক হলে)
        if (err.code === '23505' && err.constraint === 'files_file_hash_key') {
            return next(createError(409, "File already uploaded"));
        }

        console.error("handleSaveFileToDB Error:", err.message);
        next(createError(500, "Failed to save file to database"));
    }
};

module.exports = { 
    handleUploadSignature,
    handleSaveFileToDB,

};