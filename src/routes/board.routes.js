const express = require('express');
const router = express.Router();
const boardController = require('../controllers/board.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/:projectId', protect, boardController.getBoard);
router.post('/column', protect, boardController.createColumn);
router.post('/ticket', protect, boardController.createTicket);
router.patch('/ticket/move', protect, boardController.moveTicket);
router.patch('/column/move', protect, boardController.moveColumn);
router.delete('/ticket/:ticketId', protect, boardController.deleteTicket);
router.delete('/column/:columnId', protect, boardController.deleteColumn);

module.exports = router;
