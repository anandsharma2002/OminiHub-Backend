const express = require('express');
const { uploadDocument, getDocuments, deleteDocument, updateDocument, downloadDocument } = require('../controllers/doc.controller');
const { protect } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

const router = express.Router();

router.route('/')
    .post(protect, upload.single('file'), uploadDocument)
    .get(protect, getDocuments);

router.route('/:id')
    .put(protect, updateDocument)
    .delete(protect, deleteDocument);

router.get('/:id/download', protect, downloadDocument);

module.exports = router;
