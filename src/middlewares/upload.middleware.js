const multer = require('multer');

// Configure multer to use memory storage so we can upload directly to Supabase
const storage = multer.memoryStorage();

// File filter (Optional: restrict types if needed, currently allowing all)
const fileFilter = (req, file, cb) => {
    // accept all files
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: fileFilter,
});

module.exports = upload;
