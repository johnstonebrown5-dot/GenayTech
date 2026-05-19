# Generated manually to optimize exam/marks loading performance

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0039_add_remarks_to_grading_bands'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='examresult',
            index=models.Index(fields=['exam', 'student', 'subject', 'component'], name='acad_exam_student_subj_comp_idx'),
        ),
        migrations.AddIndex(
            model_name='examresult',
            index=models.Index(fields=['exam', 'updated_at'], name='acad_exam_updated_idx'),
        ),
        migrations.AddIndex(
            model_name='examresult',
            index=models.Index(fields=['student', 'exam'], name='acad_student_exam_idx'),
        ),
    ]
