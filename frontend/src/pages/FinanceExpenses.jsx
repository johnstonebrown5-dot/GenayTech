import React, { useEffect, useState } from 'react';
import api from '../api';

export default function FinanceExpenses() {
    const todayStr = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
    };
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        category: '',
        amount: '',
        description: '',
        date: todayStr(),
    });

    useEffect(() => {
        (async () => {
            try {
                const [expRes, catRes] = await Promise.all([
                    api.get('/finance/expenses/'),
                    api.get('/finance/expense-categories/'),
                ]);
                const expArr = Array.isArray(expRes.data) ? expRes.data : (Array.isArray(expRes.data?.results) ? expRes.data.results : []);
                const catArr = Array.isArray(catRes.data) ? catRes.data : (Array.isArray(catRes.data?.results) ? catRes.data.results : []);
                setExpenses(expArr);
                setCategories(catArr);
            } catch (e) {
                console.error("Failed to load expenses:", e);
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
            const { data } = await api.post('/finance/expenses/', formData);
            setExpenses(prev => [data, ...prev]);
            setShowForm(false);
            setFormData({
                category: '',
                amount: '',
                description: '',
                date: todayStr(),
            });
        } catch (error) {
            console.error("Failed to create expense:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
                <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft w-full sm:w-auto">Add Expense</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">New Expense</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                            <select id="category" name="category" value={formData.category} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a category</option>
                                {(Array.isArray(categories) ? categories : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="3" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                        </div>
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                            <input type="date" id="date" name="date" value={formData.date} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save Expense</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense List</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Category</th>
                                <th scope="col" className="px-6 py-3">Amount</th>
                                <th scope="col" className="px-6 py-3">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(expenses) && expenses.length > 0 ? (
                                expenses.map(e => (
                                    <tr key={e.id} className="bg-white border-b">
                                        <td className="px-6 py-4">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{(Array.isArray(categories)?categories:[]).find(c => c.id === e.category)?.name}</td>
                                        <td className="px-6 py-4">KES {Number(e.amount || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4">{e.description}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="px-6 py-6 text-gray-500" colSpan={4}>{loading ? 'Loading…' : 'No expenses found.'}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
