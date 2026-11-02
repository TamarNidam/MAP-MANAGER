using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MapManager.Api.Tests.Http;

public sealed class MongoApiFactory(string connectionString, string databaseName) : WebApplicationFactory<Program>
{
    public string ConnectionString => connectionString;

    public string DatabaseName => databaseName;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Mongo:ConnectionString", connectionString);
        builder.UseSetting("Mongo:DatabaseName", databaseName);
    }
}
