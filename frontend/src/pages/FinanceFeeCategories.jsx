import React, { useEffect, useState } from 'react';
import api from '../api';

export default function FinanceFeeCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/finance/fee-categories/');
                setCategories(data);
            } catch (e) {
                console.error("Failed to load fee categories:", e);
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
            if (editingCategory) {
                const { data } = await api.put(`/finance/fee-categories/${editingCategory.id}/`, formData);
                setCategories(prev => prev.map(c => c.id === editingCategory.id ? data : c));
                setEditingCategory(null);
            } else {
                const { data } = await api.post('/finance/fee-categories/', formData);
                setCategories(prev => [data, ...prev]);
            }
            setShowForm(false);
            setFormData({ name: '', description: '' });
        } catch (error) {
            console.error("Failed to save fee category:", error);
        }
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({ name: category.name, description: category.description });
        setShowForm(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Fee Categories</h1>
                <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft w-full sm:w-auto">Create Category</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{editingCategory ? 'Edit Fee Category' : 'New Fee Category'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="3" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save Category</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Category List</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Description</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(c => (
                                <tr key={c.id} className="bg-white border-b">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{c.name}</td>
                                    <td className="px-6 py-4">{c.description}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleEdit(c)} className="font-medium text-blue-600 hover:underline">Edit</button>
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
