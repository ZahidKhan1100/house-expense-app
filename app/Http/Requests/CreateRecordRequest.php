<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'category_id' => 'nullable|exists:categories,id',
            'included_mates' => 'required|array',
            'included_mates.*' => 'exists:users,id',
            'paid_by' => 'required|exists:users,id',
            'month' => 'nullable|string',
        ];
    }
}