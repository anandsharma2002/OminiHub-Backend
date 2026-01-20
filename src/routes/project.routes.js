const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/', protect, projectController.createProject);
router.get('/', protect, projectController.getProjects);
router.get('/invitations', protect, projectController.getInvitations);
router.post('/invitations/respond', protect, projectController.respondToInvitation);
router.get('/:id', protect, projectController.getProject);
// ...
router.post('/:id/invite', protect, projectController.inviteUser);
router.delete('/contributors', protect, projectController.removeContributor);

module.exports = router;
