import React, { useEffect, useState } from 'react';
import api from '../api';

export default function FinanceInvoices() {
    const todayStr = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
    };
    const [invoices, setInvoices] = useState([]);
    const [students, setStudents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        student: '',
        category: '',
        amount: '',
        due_date: todayStr(),
    });

    useEffect(() => {
        (async () => {
            try {
                const [invRes, stuRes, catRes] = await Promise.all([
                    api.get('/finance/invoices/'),
                    api.get('/academics/students/'), // Assuming an endpoint to fetch students
                    api.get('/finance/fee-categories/'),
                ]);

                const toArr = (data) => Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);

                setInvoices(toArr(invRes?.data));
                setStudents(toArr(stuRes?.data));
                setCategories(toArr(catRes?.data));
            } catch (e) {
                console.error("Failed to load data:", e);
                setInvoices([]);
                setStudents([]);
                setCategories([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/finance/invoices/', formData);
            setInvoices(prev => [data, ...prev]);
            setShowForm(false);
            setFormData({
                student: '',
                category: '',
                amount: '',
                due_date: todayStr(),
            });
        } catch (error) {
            console.error("Failed to create invoice:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
                <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft">Create Invoice</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">New Invoice</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="student" className="block text-sm font-medium text-gray-700">Student</label>
                            <select id="student" name="student" value={formData.student} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a student</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                            <select id="category" name="category" value={formData.category} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a category</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">Due Date</label>
                            <input type="date" id="due_date" name="due_date" value={formData.due_date} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save Invoice</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice List</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Student</th>
                                <th scope="col" className="px-6 py-3">Category</th>
                                <th scope="col" className="px-6 py-3">Amount</th>
                                <th scope="col" className="px-6 py-3">Due Date</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(invoices) ? invoices : []).map(i => (
                                <tr key={i.id} className="bg-white border-b">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{(Array.isArray(students)?students:[]).find(s => s.id === i.student)?.name || i.student_name || i.student}</td>
                                    <td className="px-6 py-4">{(Array.isArray(categories)?categories:[]).find(c => c.id === i.category)?.name || i.category_name || i.category}</td>
                                    <td className="px-6 py-4">KES {Number(i.amount || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4">{i.due_date ? new Date(i.due_date).toLocaleDateString() : '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${i.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            {i.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
