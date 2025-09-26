import Joi from 'joi';

export const microsoftGraphSchemas = {
  callback: Joi.object({
    code: Joi.string().required().messages({
      'string.empty': 'Authorization code is required',
      'any.required': 'Authorization code is required'
    })
  }),

  createEvent: Joi.object({
    title: Joi.string().required().min(1).max(255).messages({
      'string.empty': 'Event title is required',
      'string.min': 'Event title must not be empty',
      'string.max': 'Event title must not exceed 255 characters',
      'any.required': 'Event title is required'
    }),
    description: Joi.string().optional().allow('').max(2000).messages({
      'string.max': 'Event description must not exceed 2000 characters'
    }),
    startTime: Joi.date().iso().required().messages({
      'date.format': 'Start time must be a valid ISO date',
      'any.required': 'Start time is required'
    }),
    endTime: Joi.date().iso().required().greater(Joi.ref('startTime')).messages({
      'date.format': 'End time must be a valid ISO date',
      'date.greater': 'End time must be after start time',
      'any.required': 'End time is required'
    }),
    isFlexible: Joi.boolean().optional().default(false),
    travelTimeBefore: Joi.number().integer().min(0).max(480).optional().messages({
      'number.base': 'Travel time before must be a number',
      'number.integer': 'Travel time before must be an integer',
      'number.min': 'Travel time before must be at least 0 minutes',
      'number.max': 'Travel time before must not exceed 480 minutes (8 hours)'
    }),
    travelTimeAfter: Joi.number().integer().min(0).max(480).optional().messages({
      'number.base': 'Travel time after must be a number',
      'number.integer': 'Travel time after must be an integer',
      'number.min': 'Travel time after must be at least 0 minutes',
      'number.max': 'Travel time after must not exceed 480 minutes (8 hours)'
    })
  }),

  updateEvent: Joi.object({
    title: Joi.string().optional().min(1).max(255).messages({
      'string.min': 'Event title must not be empty',
      'string.max': 'Event title must not exceed 255 characters'
    }),
    description: Joi.string().optional().allow('').max(2000).messages({
      'string.max': 'Event description must not exceed 2000 characters'
    }),
    startTime: Joi.date().iso().optional().messages({
      'date.format': 'Start time must be a valid ISO date'
    }),
    endTime: Joi.date().iso().optional().when('startTime', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('startTime')).messages({
        'date.greater': 'End time must be after start time'
      }),
      otherwise: Joi.date()
    }).messages({
      'date.format': 'End time must be a valid ISO date'
    }),
    isFlexible: Joi.boolean().optional(),
    travelTimeBefore: Joi.number().integer().min(0).max(480).optional().messages({
      'number.base': 'Travel time before must be a number',
      'number.integer': 'Travel time before must be an integer',
      'number.min': 'Travel time before must be at least 0 minutes',
      'number.max': 'Travel time before must not exceed 480 minutes (8 hours)'
    }),
    travelTimeAfter: Joi.number().integer().min(0).max(480).optional().messages({
      'number.base': 'Travel time after must be a number',
      'number.integer': 'Travel time after must be an integer',
      'number.min': 'Travel time after must be at least 0 minutes',
      'number.max': 'Travel time after must not exceed 480 minutes (8 hours)'
    })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};