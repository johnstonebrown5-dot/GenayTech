# Generated manually to optimize exam/marks loading performance

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0038_add_remarks_to_grading_bands'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='examresult',
            index=models.Index(fields=['exam', 'subject', 'student'], name='acad_exam_subject_student_idx'),
        ),
    ]
