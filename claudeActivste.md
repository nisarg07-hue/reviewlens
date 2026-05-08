model_list:
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: nvidia_nim/meta/llama-3.1-8b-instruct
      api_key: "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"
      drop_params: true
      additional_drop_params: ["output_config"]
  - model_name: claude-sonnet-4-6
    litellm_params:
      model: nvidia_nim/meta/llama-3.1-8b-instruct
      api_key: "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"
      drop_params: true
      additional_drop_params: ["output_config"]
  - model_name: claude-3-5-sonnet
    litellm_params:
      model: nvidia_nim/meta/llama-3.1-8b-instruct
      api_key: "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"
      drop_params: true
      additional_drop_params: ["output_config"]

      //2
      & "C:\Users\pgosa\AppData\Roaming\Python\Python313\Scripts\litellm.exe" --config config.yaml --port 4000

      //3
      $env:ANTHROPIC_BASE_URL="http://127.0.0.1:4000"
$env:ANTHROPIC_API_KEY="sk-ant-1234567890123456789012345678901234567890"
claude --dangerously-skip-permissions