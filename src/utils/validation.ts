import Joi from 'joi';
import { Priority, TaskStatus, CalendarSource } from '../models/types';

// Common validation schemas
export const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    }),
  timezone: Joi.string().required(),
  priority: Joi.string().valid(...Object.values(['low', 'medium', 'high', 'critical'] as Priority[])).required(),
  taskStatus: Joi.string().valid(...Object.values(['pending', 'scheduled', 'in_progress', 'completed', 'blocked'] as TaskStatus[])),
  calendarSource: Joi.string().valid(...Object.values(['momentum', 'google', 'microsoft'] as CalendarSource[])),
  dateTime: Joi.date().iso().required(),
  positiveInteger: Joi.number().integer().min(1).required(),
  nonNegativeInteger: Joi.number().integer().min(0).required(),
  timeString: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'Time must be in HH:mm format'
    }),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required()
    .messages({
      'string.pattern.base': 'Color must be a valid hex color code (e.g., #FF0000)'
    })
};

// User validation schemas
export const userSchemas = {
  register: Joi.object({
    email: commonSchemas.email,
    name: Joi.string().min(1).max(255).required(),
    timezone: commonSchemas.timezone,
    password: commonSchemas.password,
    confirmPassword: Joi.string().required().valid(Joi.ref('password'))
      .messages({
        'any.only': 'Passwords must match'
      })
  }),

  createUser: Joi.object({
    email: commonSchemas.email,
    name: Joi.string().min(1).max(255).required(),
    timezone: commonSchemas.timezone,
    password: commonSchemas.password
  }),

  updateUser: Joi.object({
    name: Joi.string().min(1).max(255),
    timezone: commonSchemas.timezone,
    workingHours: Joi.object({
      monday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }),
      tuesday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }),
      wednesday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }),
      thursday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }),
      friday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }),
      saturday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      sunday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      lunchBreak: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional()
    }),
    preferences: Joi.object({
      maxContinuousWorkTime: commonSchemas.positiveInteger,
      preferredBreakDuration: commonSchemas.positiveInteger,
      groupSimilarTasks: Joi.boolean(),
      protectFocusTime: Joi.boolean(),
      optimizeForEarlyCompletion: Joi.boolean(),
      defaultMeetingBuffer: commonSchemas.nonNegativeInteger,
      autoRescheduleEnabled: Joi.boolean(),
      energyPreferences: Joi.object({
        highEnergyTimes: Joi.array().items(Joi.object({
          start: commonSchemas.timeString,
          end: commonSchemas.timeString
        })),
        lowEnergyTimes: Joi.array().items(Joi.object({
          start: commonSchemas.timeString,
          end: commonSchemas.timeString
        })),
        meetingPreferredTimes: Joi.array().items(Joi.object({
          start: commonSchemas.timeString,
          end: commonSchemas.timeString
        }))
      }),
      notificationSettings: Joi.object({
        taskReminders: Joi.boolean(),
        scheduleChanges: Joi.boolean(),
        deadlineAlerts: Joi.boolean(),
        completionCelebrations: Joi.boolean()
      })
    })
  }).min(1),

  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password,
    confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
      .messages({
        'any.only': 'New passwords must match'
      })
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),

  onboarding: Joi.object({
    timezone: commonSchemas.timezone.optional(),
    workingHours: Joi.object({
      monday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      tuesday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      wednesday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      thursday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      friday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      saturday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      sunday: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional(),
      lunchBreak: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).optional()
    }).optional(),
    preferences: Joi.object({
      maxContinuousWorkTime: commonSchemas.positiveInteger.optional(),
      preferredBreakDuration: commonSchemas.positiveInteger.optional(),
      groupSimilarTasks: Joi.boolean().optional(),
      protectFocusTime: Joi.boolean().optional(),
      optimizeForEarlyCompletion: Joi.boolean().optional(),
      defaultMeetingBuffer: commonSchemas.nonNegativeInteger.optional(),
      autoRescheduleEnabled: Joi.boolean().optional(),
      energyPreferences: Joi.object({
        highEnergyTimes: Joi.array().items(Joi.object({
          start: commonSchemas.timeString,
          end: commonSchemas.timeString
        })).optional(),
        lowEnergyTimes: Joi.array().items(Joi.object({
          start: commonSchemas.timeString,
          end: commonSchemas.timeString
        })).optional(),
        meetingPreferredTimes: Joi.array().items(Joi.object({
          start: commonSchemas.timeString,
          end: commonSchemas.timeString
        })).optional()
      }).optional(),
      notificationSettings: Joi.object({
        taskReminders: Joi.boolean().optional(),
        scheduleChanges: Joi.boolean().optional(),
        deadlineAlerts: Joi.boolean().optional(),
        completionCelebrations: Joi.boolean().optional()
      }).optional()
    }).optional()
  }).min(1)
};

// Task validation schemas
export const taskSchemas = {
  createTask: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    duration: commonSchemas.positiveInteger,
    priority: commonSchemas.priority,
    deadline: commonSchemas.dateTime.optional(),
    isHardDeadline: Joi.boolean().default(false),
    isBlocking: Joi.boolean().default(false),
    projectId: commonSchemas.uuid.optional()
  }),

  updateTask: Joi.object({
    title: Joi.string().min(1).max(255),
    description: Joi.string().max(1000).allow(''),
    duration: commonSchemas.positiveInteger,
    priority: commonSchemas.priority,
    deadline: commonSchemas.dateTime.allow(null),
    isHardDeadline: Joi.boolean(),
    isBlocking: Joi.boolean(),
    projectId: commonSchemas.uuid.allow(null)
  }).min(1),

  taskCompletion: Joi.object({
    minutesCompleted: commonSchemas.positiveInteger,
    notes: Joi.string().max(500).optional(),
    isFullCompletion: Joi.boolean().required()
  })
};

// Project validation schemas
export const projectSchemas = {
  createProject: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    color: commonSchemas.color
  }),

  updateProject: Joi.object({
    name: Joi.string().min(1).max(255),
    description: Joi.string().max(1000).allow(''),
    color: commonSchemas.color
  }).min(1)
};

// Calendar event validation schemas
export const calendarEventSchemas = {
  createEvent: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    startTime: commonSchemas.dateTime,
    endTime: commonSchemas.dateTime,
    isFlexible: Joi.boolean().default(false),
    travelTimeBefore: commonSchemas.nonNegativeInteger.optional(),
    travelTimeAfter: commonSchemas.nonNegativeInteger.optional()
  }).custom((value, helpers) => {
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.error('custom.endTimeBeforeStart');
    }
    return value;
  }).messages({
    'custom.endTimeBeforeStart': 'End time must be after start time'
  }),

  updateEvent: Joi.object({
    title: Joi.string().min(1).max(255),
    description: Joi.string().max(1000).allow(''),
    startTime: commonSchemas.dateTime,
    endTime: commonSchemas.dateTime,
    isFlexible: Joi.boolean(),
    travelTimeBefore: commonSchemas.nonNegativeInteger.allow(null),
    travelTimeAfter: commonSchemas.nonNegativeInteger.allow(null)
  }).min(1).custom((value, helpers) => {
    if (value.startTime && value.endTime && new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.error('custom.endTimeBeforeStart');
    }
    return value;
  }).messages({
    'custom.endTimeBeforeStart': 'End time must be after start time'
  })
};

// Booking link validation schemas
export const bookingLinkSchemas = {
  createBookingLink: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    duration: commonSchemas.positiveInteger,
    availabilityWindow: Joi.object({
      daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).required(),
      timeRange: Joi.object({
        start: commonSchemas.timeString,
        end: commonSchemas.timeString
      }).required(),
      advanceBookingDays: commonSchemas.positiveInteger,
      maxBookingsPerDay: commonSchemas.positiveInteger.optional()
    }).required(),
    bufferBefore: commonSchemas.nonNegativeInteger.default(0),
    bufferAfter: commonSchemas.nonNegativeInteger.default(0),
    customUrl: Joi.string().alphanum().min(3).max(50).optional()
  }),

  bookMeeting: Joi.object({
    attendeeName: Joi.string().min(1).max(255).required(),
    attendeeEmail: commonSchemas.email,
    startTime: commonSchemas.dateTime,
    notes: Joi.string().max(500).optional()
  })
};

// Query parameter validation schemas
export const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  dateRange: Joi.object({
    startDate: commonSchemas.dateTime,
    endDate: commonSchemas.dateTime
  }).custom((value, helpers) => {
    if (new Date(value.endDate) <= new Date(value.startDate)) {
      return helpers.error('custom.endDateBeforeStart');
    }
    return value;
  }).messages({
    'custom.endDateBeforeStart': 'End date must be after start date'
  }),

  taskFilters: Joi.object({
    status: Joi.array().items(commonSchemas.taskStatus),
    priority: Joi.array().items(commonSchemas.priority),
    projectId: commonSchemas.uuid,
    hasDeadline: Joi.boolean(),
    isOverdue: Joi.boolean()
  })
};

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: errors
        }
      });
    }

    req.body = value;
    next();
  };
};

// Query validation middleware factory
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: {
          message: 'Query validation failed',
          details: errors
        }
      });
    }

    req.query = value;
    next();
  };
};