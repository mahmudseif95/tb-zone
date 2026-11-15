const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.use(require('./operations/walletAndServices'));
router.use(require('./operations/lockedLines'));
router.use(require('./operations/sales'));
router.use(require('./operations/debtsAndCustomers'));

module.exports = router;
