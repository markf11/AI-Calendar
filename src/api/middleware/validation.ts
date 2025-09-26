import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationError {
  field: string;
  message: string;
}

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
      return;
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        success: false,
        error: 'Query validation failed',
        details: validationErrors
      });
      return;
    }

    // Replace req.query with validated and sanitized data
    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        success: false,
        error: 'Parameter validation failed',
        details: validationErrors
      });
      return;
    }

    // Replace req.params with validated and sanitized data
    req.params = value;
    next();
  };
};

export const validateHeaders = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.headers, {
      abortEarly: false,
      allowUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        success: false,
        error: 'Header validation failed',
        details: validationErrors
      });
      return;
    }

    next();
  };
};

// Booking Link Validation Schemas
const timeRangeSchema = Joi.object({
  start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'Time must be in HH:mm format'
    }),
  end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'Time must be in HH:mm format'
    })
}).custom((value, helpers) => {
  if (value.start >= value.end) {
    return helpers.error('any.invalid', { message: 'End time must be after start time' });
  }
  return value;
});

const availabilityWindowSchema = Joi.object({
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).required()
    .messages({
      'array.min': 'At least one day of the week must be selected',
      'number.min': 'Days of week must be between 0 (Sunday) and 6 (Saturday)',
      'number.max': 'Days of week must be between 0 (Sunday) and 6 (Saturday)'
    }),
  timeRange: timeRangeSchema.required(),
  advanceBookingDays: Joi.number().integer().min(1).max(365).required()
    .messages({
      'number.min': 'Advance booking days must be at least 1',
      'number.max': 'Advance booking days cannot exceed 365'
    }),
  maxBookingsPerDay: Joi.number().integer().min(1).optional()
    .messages({
      'number.min': 'Maximum bookings per day must be at least 1'
    })
});

const bookingLinkCreationSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': 'Title must be 100 characters or less'
    }),
  duration: Joi.number().integer().min(1).max(480).required()
    .messages({
      'number.min': 'Duration must be greater than 0',
      'number.max': 'Duration cannot exceed 8 hours (480 minutes)'
    }),
  availabilityWindow: availabilityWindowSchema.required(),
  bufferBefore: Joi.number().integer().min(0).max(120).default(0)
    .messages({
      'number.min': 'Buffer time cannot be negative',
      'number.max': 'Buffer time cannot exceed 2 hours (120 minutes)'
    }),
  bufferAfter: Joi.number().integer().min(0).max(120).default(0)
    .messages({
      'number.min': 'Buffer time cannot be negative',
      'number.max': 'Buffer time cannot exceed 2 hours (120 minutes)'
    }),
  customUrl: Joi.string().trim().min(3).max(50).pattern(/^[a-zA-Z0-9_-]+$/).optional()
    .invalid('api', 'admin', 'www', 'app', 'book', 'calendar', 'dashboard', 'settings', 'help', 'support')
    .messages({
      'string.min': 'Custom URL must be at least 3 characters long',
      'string.max': 'Custom URL must be 50 characters or less',
      'string.pattern.base': 'Custom URL can only contain letters, numbers, hyphens, and underscores',
      'any.invalid': 'This URL is reserved and cannot be used'
    })
});

const bookingLinkUpdateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).optional()
    .messages({
      'string.empty': 'Title cannot be empty',
      'string.max': 'Title must be 100 characters or less'
    }),
  duration: Joi.number().integer().min(1).max(480).optional()
    .messages({
      'number.min': 'Duration must be greater than 0',
      'number.max': 'Duration cannot exceed 8 hours (480 minutes)'
    }),
  availabilityWindow: availabilityWindowSchema.optional(),
  bufferBefore: Joi.number().integer().min(0).max(120).optional()
    .messages({
      'number.min': 'Buffer time cannot be negative',
      'number.max': 'Buffer time cannot exceed 2 hours (120 minutes)'
    }),
  bufferAfter: Joi.number().integer().min(0).max(120).optional()
    .messages({
      'number.min': 'Buffer time cannot be negative',
      'number.max': 'Buffer time cannot exceed 2 hours (120 minutes)'
    }),
  customUrl: Joi.string().trim().min(3).max(50).pattern(/^[a-zA-Z0-9_-]+$/).optional()
    .invalid('api', 'admin', 'www', 'app', 'book', 'calendar', 'dashboard', 'settings', 'help', 'support')
    .messages({
      'string.min': 'Custom URL must be at least 3 characters long',
      'string.max': 'Custom URL must be 50 characters or less',
      'string.pattern.base': 'Custom URL can only contain letters, numbers, hyphens, and underscores',
      'any.invalid': 'This URL is reserved and cannot be used'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Booking Link Validation Middleware
export const validateBookingLinkCreation = validateRequest(bookingLinkCreationSchema);
export const validateBookingLinkUpdate = validateRequest(bookingLinkUpdateSchema);

// Meeting Booking Validation Schemas
const meetingBookingSchema = Joi.object({
  attendeeName: Joi.string().trim().min(1).max(100).required()
    .messages({
      'string.empty': 'Attendee name is required',
      'string.max': 'Attendee name must be 100 characters or less'
    }),
  attendeeEmail: Joi.string().email().required()
    .messages({
      'string.email': 'Valid attendee email is required',
      'string.empty': 'Attendee email is required'
    }),
  startTime: Joi.date().iso().greater('now').required()
    .messages({
      'date.base': 'Valid start time is required',
      'date.greater': 'Start time must be in the future',
      'any.required': 'Start time is required'
    }),
  notes: Joi.string().max(500).optional()
    .messages({
      'string.max': 'Notes must be 500 characters or less'
    })
});

const meetingRescheduleSchema = Joi.object({
  newStartTime: Joi.date().iso().greater('now').required()
    .messages({
      'date.base': 'Valid new start time is required',
      'date.greater': 'New start time must be in the future',
      'any.required': 'New start time is required'
    }),
  reason: Joi.string().max(200).optional()
    .messages({
      'string.max': 'Reason must be 200 characters or less'
    })
});

// Meeting Booking Validation Middleware
export const validateMeetingBooking = validateRequest(meetingBookingSchema);
export const validateMeetingReschedule = validateRequest(meetingRescheduleSchema);