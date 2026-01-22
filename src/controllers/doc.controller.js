const supabase = require('../config/supabase');
const Documentation = require('../models/Documentation');
const { v4: uuidv4 } = require('uuid');
const { emitToUser, emitToRoom } = require('../socket/socket');

// @desc    Upload a new document
// @route   POST /api/docs
// @access  Private
exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a file' });
        }

        const { name, description, privacy } = req.body;
        const file = req.file;

        // Create a unique file path: UserID/UUID_OriginalName
        const uniqueFileName = `${req.user._id}/${uuidv4()}_${file.originalname}`;

        // 1. Upload to Supabase
        const { data, error } = await supabase.storage
            .from('Documents')
            .upload(uniqueFileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            return res.status(500).json({ message: 'File upload failed', error: error.message });
        }

        // 2. Create DB Entry
        const doc = await Documentation.create({
            name: name || file.originalname,
            description,
            privacy: privacy || 'private',
            filePath: data.path,
            fileType: file.mimetype,
            fileSize: file.size,
            user: req.user._id,
        });

        // Real-time Update
        // 1. To Owner (update their Documents list)
        emitToUser(req.user._id, 'document_update', { action: 'create', doc });

        // 2. If Public, To Profile Viewers
        if (doc.privacy === 'public') {
            emitToRoom(`profile_${req.user._id}`, 'document_update', { action: 'create', doc });
        }

        res.status(201).json(doc);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get documents (Own or Public of Specific User)
// @route   GET /api/docs
// @access  Private
exports.getDocuments = async (req, res) => {
    try {
        const { userId } = req.query;
        let query = {};

        if (userId) {
            // Case 1: Fetching documents for a specific user (e.g., Profile View)
            if (userId === req.user._id.toString()) {
                // If viewing own profile/docs explicitly -> show all my docs
                query = { user: req.user._id };
            } else {
                // If viewing someone else's profile -> show ONLY their public docs
                query = { user: userId, privacy: 'public' };
            }
        } else {
            // Case 2: Default view (/docs route) -> Show ONLY my own documents (Private + Public)
            query = { user: req.user._id };
        }

        const docs = await Documentation.find(query)
            .populate('user', 'username email profile.image')
            .sort({ createdAt: -1 });

        res.json(docs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update document metadata
// @route   PUT /api/docs/:id
// @access  Private
exports.updateDocument = async (req, res) => {
    try {
        let doc = await Documentation.findById(req.params.id);

        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Check ownership
        if (doc.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const wasPublic = doc.privacy === 'public';

        doc = await Documentation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        const isPublic = doc.privacy === 'public';

        // Real-time Update
        // 1. To Owner (ALWAYS)
        emitToUser(req.user._id, 'document_update', { action: 'update', doc });

        // 2. To Profile Viewers (If it WAS public OR IS public)
        // If it was public and now private -> Update needed to remove it from view
        // If it was private and now public -> Update needed to add it to view
        if (wasPublic || isPublic) {
            emitToRoom(`profile_${req.user._id}`, 'document_update', { action: 'update', doc });
        }

        res.json(doc);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete document
// @route   DELETE /api/docs/:id
// @access  Private
exports.deleteDocument = async (req, res) => {
    try {
        const doc = await Documentation.findById(req.params.id);

        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Check ownership
        if (doc.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // 1. Delete from Supabase
        const { error } = await supabase.storage
            .from('Documents')
            .remove([doc.filePath]);

        if (error) {
            console.error('Supabase Delete Error:', error);
            // We might still want to delete from DB or warn? 
            // Let's fail safe, but if file doesn't exist just proceed.
        }

        const wasPublic = doc.privacy === 'public';
        const docId = doc._id;
        const ownerId = doc.user;

        // 2. Delete from DB
        await doc.deleteOne();

        // Real-time Update
        emitToUser(ownerId, 'document_update', { action: 'delete', docId });

        if (wasPublic) {
            emitToRoom(`profile_${ownerId}`, 'document_update', { action: 'delete', docId });
        }


        res.json({ message: 'Document removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get Download Link
// @route   GET /api/docs/:id/download
// @access  Private
exports.downloadDocument = async (req, res) => {
    try {
        const doc = await Documentation.findById(req.params.id);

        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Permission Check: Owner OR Public
        if (doc.privacy !== 'public' && doc.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to access this private document' });
        }

        // Generate Signed URL (valid for 60 seconds)
        const { data, error } = await supabase.storage
            .from('Documents')
            .createSignedUrl(doc.filePath, 60);

        if (error) {
            return res.status(500).json({ message: 'Could not generate download link' });
        }

        // Redirect user to the signed URL
        res.json({ downloadUrl: data.signedUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
