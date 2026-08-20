import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'بوابة رفيقي للحياة المدرسية — API',
      version: '1.0.0',
      description:
        'توثيق تلقائي لواجهة برمجة التطبيقات لمنصة «بوابة رفيقي للحياة المدرسية».\n\n' +
        'المصادقة: أضف الترويسة `Authorization: Bearer <token>` لجميع المسارات المحمية.\n\n' +
        'الأدوار: STUDENT / PARENT / TEACHER / SCHOOL_DIRECTOR / ADMIN / SUPER_ADMIN'
    },
    servers: [{ url: '/', description: 'الخادم الحالي' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'رسالة الخطأ بالعربية' },
            details: { type: 'object', description: 'تفاصيل إضافية (اختياري)' },
            errors: {
              type: 'array',
              description: 'قائمة أخطاء التحقق',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      { name: 'auth', description: 'المصادقة والتسجيل' },
      { name: 'subscriptions', description: 'الاشتراكات والطلبات والمدفوعات' },
      { name: 'attendance', description: 'الحضور والغياب' },
      { name: 'public', description: 'المحتوى العمومي' },
      { name: 'registrations', description: 'طلبات التسجيل' },
      { name: 'students', description: 'التلاميذ' },
      { name: 'admin', description: 'الإدارة العامة' },
      { name: 'help-requests', description: 'طلبات المساعدة والتواصل' },
      { name: 'calendar', description: 'الرزنامة والأحداث' },
      { name: 'health', description: 'السجلات الصحية' },
      { name: 'parent', description: 'فضاء الولي' },
      { name: 'play-zone', description: 'منطقة الألعاب' },
      { name: 'curriculum', description: 'المنهاج والكتب والقصة' },
      { name: 'messages', description: 'المراسلات' },
      { name: 'parent-documents', description: 'وثائق الأولياء' },
      { name: 'assignments', description: 'التكليفات المنزلية' },
      { name: 'analytics', description: 'التقارير التحليلية والتصدير' },
      { name: 'superadmin', description: 'الإدارة النظامية' },
      { name: 'director', description: 'فضاء مدير المدرسة' },
      { name: 'teacher', description: 'فضاء الأستاذ' },
      { name: 'teacher-content', description: 'المذكرات والموارد والاختبارات الرسمية' },
      { name: 'teacher-plans', description: 'المخططات والجداول' },
      { name: 'class-subjects', description: 'مواد الأقسام' },
      { name: 'submitted-exams', description: 'أوراق الاختبارات الممسوحة' },
      { name: 'payments', description: 'المدفوعات الإلكترونية (المرحلة 4.1)' },
      { name: 'ai', description: 'الذكاء الاصطناعي' },
      { name: 'live-sessions', description: 'الحصص المباشرة وجدولتها وتفاعلاتها (المرحلة 5.1 + 5.2)' }
    ]
  },
  apis: [path.join(__dirname, './routes/*.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
