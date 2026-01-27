# EDU-TRACK — System Overview

## Vendor (Company) Contact

- **Company:** EDUTRACK
- **Email:** edutrack46@gmail.com
- **Phone:** 0796031071

## Document Scope

This document summarizes what EDU-TRACK provides, who uses it, and the major functional areas commonly enabled in a school deployment.

## 1. Purpose

EDU-TRACK is a school management system designed to support day-to-day school operations including student management, academics, and finance workflows.

## 2. Target Users

- School administrators
- Teachers
- Accounts/finance staff
- Students/parents (if enabled)

## 3. Major Features (high level)

- Student registration and management
- Class/stream management
- Attendance tracking
- Academic records and reporting
- Fee management and statement templates
- Role-based access control (RBAC)

## 4. Typical modules (common deployments)

- **Students:** admissions, biodata, guardians
- **Academics:** classes/streams, subjects, assessments
- **Attendance:** daily attendance tracking and summaries
- **Finance:** fee structures, balances, statements and exports
- **Users & Roles:** staff accounts, permissions, access control

## 4.1 Dashboards (role-based)

EDU-TRACK provides dashboards depending on the signed-in user role. Common dashboards include:

- **Admin dashboard:** high-level school status such as total learners, staff, class distribution, quick links to configuration, and operational summaries.
- **Teacher dashboard:** quick access to assigned classes/streams, attendance shortcuts, and marks entry areas.
- **Finance dashboard:** fee balances, collection summaries, arrears lists, and quick statement generation.
- **Student dashboard (if enabled):** results/performance views, fee balance/statement access, and notifications.

## 4.2 Navigation tabs (what is in the system)

Exact names may differ by deployment, but most schools will see tabs similar to the following:

- **Dashboard/Home:** role-based overview and shortcuts
- **Students:** admissions, biodata, enrollment, and profiles
- **Guardians/Parents:** parent/guardian contacts and communication targets (where enabled)
- **Classes/Streams:** class lists, stream setup, and allocations
- **Subjects:** subject setup and mapping to classes
- **Attendance:** daily attendance capture and summaries
- **Timetable:** lesson schedules by class/teacher (where enabled)
- **Exams/Assessments:** exam setup, mark entry, grading, and moderation (where enabled)
- **Results/Reports:** performance summaries, report cards, exports (where enabled)
- **Finance/Fees:** fee structures, balances, payments, statements, exports
- **Messaging/Notifications:** SMS/email/in-app notices (where enabled)
- **Users/Roles:** staff accounts, permissions, and access control
- **Settings:** school profile, academic year/term, and system configuration

## 4.3 Notifications (SMS, Email, and In-app)

EDU-TRACK supports multiple communication channels depending on how the school configures it:

- **SMS notifications:** commonly used for fee reminders, attendance alerts, or announcements (requires an SMS provider such as Africa’s Talking and sufficient credit).
- **Email notifications (SMTP):** commonly used for statements, official communication, and system messages (requires a valid email address and SMTP configuration).
- **In-app notifications:** alerts visible when the user signs into EDU-TRACK (useful for staff/student announcements).

Recommended practice:

- use SMS for short, time-sensitive notices
- use email for detailed communication and statements
- avoid including sensitive information in SMS

## 4.4 Timetable management

Where enabled, the Timetable area can be used to:

- define lesson periods (start/end times)
- assign subjects to classes/streams
- allocate teachers and rooms (if configured)
- publish timetables for teachers and students

## 4.5 Exam and assessment management

Where enabled, the Exams/Assessments area typically supports:

- creating an exam/assessment (term, class, subject, category)
- entering marks per learner
- computing totals, averages, and performance summaries
- generating class and student reports

Controls typically include role restrictions (teachers enter marks, admins approve/close submissions).

## 4.6 Finance management

The Finance/Fees area typically supports:

- setting fee items and fee structures
- applying/posting charges per term
- recording payments and references (receipts/transaction IDs)
- generating statements (print/email where enabled)
- tracking arrears and finance summaries

## 5. Technology Stack (as implemented in this repository)

- Backend: Django 5 + Django REST Framework (DRF) + JWT
- Database: PostgreSQL
- Frontend: React 18 + Vite + TailwindCSS + Axios
- Deployment (recommended): Docker Compose

## 6. Environments

- Development: local machine
- Production: school-hosted server (on-premises or school-managed cloud VM)

## 7. Assumptions and Responsibilities (School-Hosted)

- The School manages the hosting server, network access, backups, and security.
- The Vendor provides the Software and may provide support if purchased separately.

For support escalation, provide:

- a short description of the issue
- time of occurrence
- affected users/roles
- screenshots (if applicable)
- basic logs (if available)

## 8. Key benefits

Common benefits of EDU-TRACK in a school environment include:

- **Centralized data:** one source of truth for learners, staff, academics, and finance records.
- **Faster reporting:** quicker access to class lists, performance summaries, and finance reports.
- **Improved accountability:** role-based access and clearer workflows reduce errors.
- **Better communication:** SMS, email, and in-app announcements improve parent/student engagement (where enabled).
- **Operational efficiency:** standardized processes for admissions, attendance, exams, and statements.
