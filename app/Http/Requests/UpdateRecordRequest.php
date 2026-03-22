<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRecordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'description' => 'sometimes|string|max:255',
            'amount' => 'sometimes|numeric|min:0',
            'category_id' => 'sometimes|exists:categories,id',
            'included_mates' => 'sometimes|array',
            'included_mates.*' => 'exists:users,id',
            'paid_by' => 'sometimes|exists:users,id',
            'month' => 'sometimes|string',
        ];
    }
}