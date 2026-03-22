<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // or add user permissions
    }

    public function rules(): array
    {
        return [
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0.01',
            'category_id' => 'required|exists:categories,id',
            'included_mates' => 'required|array|min:1',
            'included_mates.*' => 'exists:users,id',
            'paid_by' => 'nullable|exists:users,id',
        ];
    }
}