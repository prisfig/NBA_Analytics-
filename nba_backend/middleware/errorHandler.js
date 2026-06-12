// ============================================
//  middleware/errorHandler.js
//  Centralized error handler — no more
//  copy-pasted res.status(500).send(err) everywhere
// ============================================

function errorHandler(err, _req, res, _next) {
  const statusCode = err.status || 500;
  console.error(`[Error] ${err.message}`);
  res.status(statusCode).json({
    error:   err.message || 'Internal server error',
    status:  statusCode,
  });
}

// Wraps async route handlers so you don't need try/catch in every route
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };