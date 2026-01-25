const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/', protect, projectController.createProject);
router.get('/', protect, projectController.getProjects);
router.get('/invitations', protect, projectController.getInvitations);
router.get('/progress', protect, projectController.getProjectsProgress);
router.get('/:id/progress', protect, projectController.getProjectProgress);
router.post('/invitations/respond', protect, projectController.respondToInvitation);
router.get('/:id', protect, projectController.getProject);
router.put('/:id', protect, projectController.updateProject);
router.delete('/:id', protect, projectController.deleteProject);
// ...
router.post('/:id/invite', protect, projectController.inviteUser);
router.delete('/contributors', protect, projectController.removeContributor);

module.exports = router;
