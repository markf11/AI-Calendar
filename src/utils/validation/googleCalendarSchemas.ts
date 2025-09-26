import Joi from 'joi';

export const callbackSchema = Joi.object({
  code: Joi.string().required().messages({
    'string.empty': 'Authorization code is required',
    'any.required': 'Authorization code is required'
  })
});

export const createEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Event title is required',
    'string.min': 'Event title must be at least 1 character long',
    'string.max': 'Event title must be less than 255 characters',
    'any.required': 'Event title is required'
  }),
  
  description: Joi.string().max(1000).optional().allow('').messages({
    'string.max': 'Event description must be less than 1000 characters'
  }),
  
  startTime: Joi.date().iso().required().messages({
    'date.base': 'Start time must be a valid date',
    'date.format': 'Start time must be in ISO format',
    'any.required': 'Start time is required'
  }),
  
  endTime: Joi.date().iso().min(Joi.ref('startTime')).required().messages({
    'date.base': 'End time must be a valid date',
    'date.format': 'End time must be in ISO format',
    'date.min': 'End time must be after start time',
    'any.required': 'End time is required'
  }),
  
  isFlexible: Joi.boolean().optional().default(false).messages({
    'boolean.base': 'isFlexible must be a boolean value'
  }),
  
  travelTimeBefore: Joi.number().integer().min(0).max(480).optional().messages({
    'number.base': 'Travel time before must be a number',
    'number.integer': 'Travel time before must be an integer',
    'number.min': 'Travel time before must be at least 0 minutes',
    'number.max': 'Travel time before must be less than 480 minutes (8 hours)'
  }),
  
  travelTimeAfter: Joi.number().integer().min(0).max(480).optional().messages({
    'number.base': 'Travel time after must be a number',
    'number.integer': 'Travel time after must be an integer',
    'number.min': 'Travel time after must be at least 0 minutes',
    'number.max': 'Travel time after must be less than 480 minutes (8 hours)'
  })
});

export const updateEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional().messages({
    'string.empty': 'Event title cannot be empty',
    'string.min': 'Event title must be at least 1 character long',
    'string.max': 'Event title must be less than 255 characters'
  }),
  
  description: Joi.string().max(1000).optional().allow('').messages({
    'string.max': 'Event description must be less than 1000 characters'
  }),
  
  startTime: Joi.date().iso().optional().messages({
    'date.base': 'Start time must be a valid date',
    'date.format': 'Start time must be in ISO format'
  }),
  
  endTime: Joi.date().iso().when('startTime', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startTime')),
    otherwise: Joi.date()
  }).optional().messages({
    'date.base': 'End time must be a valid date',
    'date.format': 'End time must be in ISO format',
    'date.min': 'End time must be after start time'
  }),
  
  isFlexible: Joi.boolean().optional().messages({
    'boolean.base': 'isFlexible must be a boolean value'
  }),
  
  travelTimeBefore: Joi.number().integer().min(0).max(480).optional().messages({
    'number.base': 'Travel time before must be a number',
    'number.integer': 'Travel time before must be an integer',
    'number.min': 'Travel time before must be at least 0 minutes',
    'number.max': 'Travel time before must be less than 480 minutes (8 hours)'
  }),
  
  travelTimeAfter: Joi.number().integer().min(0).max(480).optional().messages({
    'number.base': 'Travel time after must be a number',
    'number.integer': 'Travel time after must be an integer',
    'number.min': 'Travel time after must be at least 0 minutes',
    'number.max': 'Travel time after must be less than 480 minutes (8 hours)'
  })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const syncEventsSchema = Joi.object({
  syncToken: Joi.string().optional().messages({
    'string.base': 'Sync token must be a string'
  }),
  
  calendarId: Joi.string().optional().default('primary').messages({
    'string.base': 'Calendar ID must be a string'
  })
});

export const webhookSchema = Joi.object({
  'x-goog-channel-id': Joi.string().required(),
  'x-goog-channel-token': Joi.string().required(),
  'x-goog-resource-state': Joi.string().valid('sync', 'exists', 'not_exists').required(),
  'x-goog-resource-id': Joi.string().optional(),
  'x-goog-resource-uri': Joi.string().optional(),
  'x-goog-message-number': Joi.string().optional()
}).unknown(true); // Allow other headers