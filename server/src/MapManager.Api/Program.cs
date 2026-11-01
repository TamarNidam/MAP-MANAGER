using MapManager.Api.Configuration;
using MapManager.Api.Infrastructure;
using MapManager.Api.Repositories;
using MapManager.Api.Services;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

// ApiExceptionHandler logs every exception itself (expected 4xx at Warning without a stack trace, the rest as errors).
// The built-in middleware would log each one again as an error with a stack trace, so its own log is turned off.
builder.Logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None);

// ---- Configuration ----
// Validated on start: a missing connection string stops the app immediately instead of failing on the first request.
builder.Services.AddOptions<MongoSettings>()
    .Bind(builder.Configuration.GetSection(MongoSettings.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// ---- MongoDB ----
// Must run before any document is serialized: enums are stored as their lowercase ids ("object", "jeep").
MongoConventions.Register();
// MongoClient is thread-safe and intended to live for the whole application lifetime.
builder.Services.AddSingleton<IMongoClient>(sp =>
    new MongoClient(sp.GetRequiredService<IOptions<MongoSettings>>().Value.ConnectionString));
builder.Services.AddSingleton<MongoContext>();
// Hosted services start in registration order: indexes first, then the default layer (it relies on the unique indexes).
builder.Services.AddHostedService<MongoIndexInitializer>();
builder.Services.AddHostedService<DefaultLayerSeeder>();
builder.Services.AddSingleton<IFeatureRepository, MongoFeatureRepository>();
builder.Services.AddSingleton<ILayerRepository, MongoLayerRepository>();

// ---- Services ----
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IMapObjectService, MapObjectService>();
builder.Services.AddScoped<IPolygonService, PolygonService>();
builder.Services.AddScoped<ILayerService, LayerService>();
builder.Services.AddScoped<IMapDataService, MapDataService>();
builder.Services.AddScoped<LayerReferenceValidator>();

// ---- Web API ----
builder.Services.AddControllers(options =>
    {
        // Without this, a body that cannot be read adds an error keyed by the C# parameter name ("request").
        // Required fields are marked with [Required] explicitly, so the implicit rule is not needed.
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
        // Validation error keys use the JSON names the client sent ("items[0].layerId"), not C# property names.
        options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider());
    })
    .AddJsonOptions(options =>
    {
        JsonConfiguration.Configure(options.JsonSerializerOptions);
        // Malformed JSON gets a generic message instead of the parser's text, which names internal .NET types.
        options.AllowInputFormatterExceptionMessages = false;
    });
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddEndpointsApiExplorer();
// Documents map-data items as "an object or a polygon" instead of an empty base type.
builder.Services.AddSwaggerGen(options => options.UseOneOfForPolymorphism());
builder.Services.AddHealthChecks().AddCheck<MongoHealthCheck>("mongodb");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
    options.AddPolicy("Client", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

// Unhandled exceptions are returned as RFC 7807 ProblemDetails responses.
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseMiddleware<RequestBodyLimitMiddleware>();

// Swagger is enabled in all environments for reviewer convenience; would be restricted in production.
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("Client");
app.MapControllers();
app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.Run();

/// <summary>The application entry point. Declared public so the HTTP tests can host the app (WebApplicationFactory).</summary>
public partial class Program;
